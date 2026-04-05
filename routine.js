const config = {
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
    classes: [6, 7, 8, 9, 10],
    sections: ["A", "B"],
    subjects: {
        6: {"Bangla":4, "English":5, "Math":4, "Science":3, "BDGS":2, "Work":8, "Religion":2, "ICT":2},
        7: {"Bangla":4, "English":5, "Math":4, "Science":3, "BDGS":2, "Work":8, "Religion":2, "ICT":2},
        8: {"Bangla":4, "English":5, "Math":4, "Science":3, "BDGS":2, "Work":8, "Religion":2, "ICT":2},
        9: {"Bangla":2, "English":3, "Math":3, "BDGS":2, "Physics":3, "Chemistry":3, "ICT":2, "Drawing":2, "Religion":2, "Trade1":8, "Trade2":8},
        10: {"Bangla":2, "English":3, "Math":3, "BDGS":2, "Physics":3, "Chemistry":3, "ICT":2, "Drawing":2, "Religion":2, "Trade1":8, "Trade2":8}
    }
};

let teachers = JSON.parse(localStorage.getItem('h_teachers')) || {};
let routineData = JSON.parse(localStorage.getItem('h_routine')) || {};
let tempAssignments = []; 
let currentTeacherLoad = {};

window.addEventListener('load', () => {loadSubPicker();            
    const subPicker = document.getElementById('subPicker');  
    subPicker.addEventListener('change', function() {               // subPicker এর সাথে eventListener যুক্ত করে দেওয়া
        const tradeSpec = document.getElementById('tradeSpec');
        if (this.value.includes("Trade")) {
            tradeSpec.style.display = "block";
        } else {
            tradeSpec.style.display = "none";
        }
    });
});

function loadSubPicker() {
    const picker = document.getElementById('subPicker'); if (!picker) return;
    let allSubs = new Set();
    Object.keys(config.subjects).forEach(cls => {Object.keys(config.subjects[cls]).forEach(sub => allSubs.add(sub));});
    picker.innerHTML = '<option value="">-- বিষয় --</option>' +  Array.from(allSubs).sort().map(sub => `<option value="${sub}">${sub}</option>`).join('');
}

function init() {    
    let html = "";
    config.days.forEach(day => {
        config.classes.forEach((cls, cIdx) => {
            config.sections.forEach((sec, sIdx) => {
                html += `<tr data-day="${day}" data-cls="${cls}" data-sec="${sec}">`;
                
                // দিন (Day) কলাম: rowspan দিয়ে ১০টি রো মার্জ করা
                if(cIdx === 0 && sIdx === 0) {html += `<td rowspan="10" style="background:#e8f0fe; font-weight:bold; font-size:14px;">${day}</td>`;}
                
                // ক্লাস (Class) কলাম: rowspan দিয়ে ২টো রো (A, B section) মার্জ করা
                if(sIdx === 0) {html += `<td rowspan="2" style="font-weight:bold; background:#fafafa;">Cls ${cls}</td>`;}
                
                // সেকশন কলাম
                html += `<td style="font-weight:bold; color:#888">${sec}</td>`;
                
                // পিরিয়ড কলামগুলো (P1 থেকে P8)
                [1, 2, 3, 4, "B", 5, 6, 7, 8].forEach(p => {

                    if(p === "B") { html += `<td class="break-cell">BREAK</td>`;        // টিফিন ব্রেক
                    } else if(cls <= 8 && p > 6) {

                        html += `<td style="background:#eee; color:#ddd;"></td>`;     // ৬ষ্ঠ পিরিয়ডের পর ক্লাস ৬-৮ এর জন্য ফাঁকা
                    } else {
                       
                        const id = `${day}-${cls}-${sec}-p${p}`;                             // সাধারণ পিরিয়ড সেল
                        const val = routineData[id] || {sub:"", tea:""};
                        const isTrade = (val.sub === "Trade1" || val.sub === "Trade2");    // ট্রেড চেক লজিক: যদি সেভ করা ডাটা ট্রেড হয়

                        html += `<td id="${id}" class="routine-cell" onmouseover="showTooltip(event, this)" onmouseout="hideTooltip()">
                            <select class="sub-sel" onchange="subChg(this)">
                                <option value="">---</option>
                                ${Object.keys(config.subjects[cls]).map(s => 
                                    `<option value="${s}" ${val.sub === s ? 'selected' : ''}>${s}</option>`
                                ).join('')}
                            </select>
                            
                            <select class="t-sel t-day-${day} t-p-${p}" onchange="manualSave()" style="${isTrade ? 'display:none' : 'display:block'}">
                                <option value="">---</option>
                                ${!isTrade ? getTOpts(val.sub, val.tea) : ''}
                            </select>
                        </td>`;
                    }
                });
                
                html += `</tr>`;
            });
        });
    });
    
    document.getElementById('routineBody').innerHTML = html;

    Object.keys(routineData).forEach(id => {            // --- ট্রেড ডাটা রেন্ডারিং (পেজ লোড হওয়ার পর) ---
        const data = routineData[id];
        const td = document.getElementById(id);
        if (td && (data.sub === "Trade1" || data.sub === "Trade2")) {
            setupTradeCell(td, data.sub);                                       // ট্রেড সেল সেটআপ করা
            
            // সেভ করা টিচারদের সিলেক্ট করা
            if (Array.isArray(data.tea)) {
                const miniSels = td.querySelectorAll('.trade-mini-sel');
                data.tea.forEach((tCode, index) => {
                    if (miniSels[index]) {
                        miniSels[index].value = tCode;
                    }
                });
            }
        }
    });
    
    // টিচার লিস্ট এবং ড্যাশবোর্ড আপডেট
    renderTList(); 
    updateUI();
    updateConflictUI(); 
    updateTeacherDownloadDropdown();
}

function getTOpts(sub, selectedT) {
    if (!sub) return '<option value="">---</option>';
    let list = Object.keys(teachers).filter(tId => teachers[tId].assignments.some(a => a.sub === sub)); // ওই বিষয়ের শিক্ষকদের ফিল্টার করা
    let html = '<option value="">---</option>';
    list.forEach(tId => {
        const t = teachers[tId];
        const displayLabel = t.trade ? `${tId}` : tId;
        html += `<option value="${tId}" ${tId === selectedT ? 'selected' : ''}>${displayLabel}</option>`;
    });
    return html;
}

function renderTList() {
    const listContainer = document.getElementById('tList'); if (!listContainer) return;
    const teacherKeys = Object.keys(teachers);
    if (teacherKeys.length === 0) { listContainer.innerHTML = `<p style="text-align:center; color:#999; padding:20px;">কোনো শিক্ষক যোগ করা হয়নি।</p>`; return; }

    listContainer.innerHTML = teacherKeys.map(tId => {
        const t = teachers[tId];
        
        // এসাইনমেন্ট থেকে ক্লাস এবং সাবজেক্টের সুন্দর লিস্ট তৈরি (যেমন: C6:Bangla, C7:English)
        const assignmentHTML = t.assignments && t.assignments.length > 0 
            ? t.assignments.map(a => `<span style="background:#f0f0f0; padding:2px 5px; border-radius:3px; margin-right:3px;">C${a.cls}:${a.sub}</span>`).join('')
            : '<span style="color:red;">No Assignments</span>';

        const tradeBadge = t.trade 
            ? `<span style="background:var(--primary); color:#fff; padding:2px 6px; border-radius:10px; font-size:10px; margin-left:5px;">Trade: ${t.trade}</span>` 
            : '';

        return `
            <div class="teacher-card" style="background:#fff; border:1px solid #d7d5d5; border-left:4px solid ${t.trade ? '#1a73e8' : '#34a853'}; padding:8px; margin-bottom:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <div style="flex:1;">
                    <div style="display:flex; align-items:center;">
                        <strong style="font-size:14px; color:#333;">${t.name} (${tId})</strong>
                        ${tradeBadge}
                    </div>
                    <div style="font-size:11px; color:#777; margin-top:5px; display:flex; flex-wrap:wrap; gap:4px;">
                        ${assignmentHTML}
                    </div>
                </div>
                <div style="display:flex; gap:8px; margin-left:15px;">
                    <button onclick="editTeacher('${tId}')" class="btn-edit" style="background:#ffc107; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; font-size:12px;">
                        Edit
                    </button>
                    <button onclick="deleteTeacher('${tId}')" class="btn-delete" style="background:#ff4444; color:#fff; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; font-size:12px;">
                        &times;
                    </button>
                </div>
            </div>
        `;
    }).join('');
}
    
function updateUI() {
    let subCounts = {}; // { class: { subject: count } }
    let teacherCounts = {}; // { teacherID: count }

    // ১. রুটিন ডেটা থেকে সাবজেক্ট এবং টিচার লোড গণনা করা
    Object.keys(routineData).forEach(cellId => {
        const data = routineData[cellId];
        if (data && data.sub) {
            const parts = cellId.split('-'); // day-cls-sec-pX
            const cls = parts[1];
            
            // সাবজেক্ট কাউন্ট আপডেট
            if (!subCounts[cls]) subCounts[cls] = {};
            subCounts[cls][data.sub] = (subCounts[cls][data.sub] || 0) + 1;

            // টিচার কাউন্ট আপডেট
            if (Array.isArray(data.tea)) {
                // ট্রেড টিচারদের জন্য (যেহেতু tea এখানে একটি অ্যারে)
                data.tea.forEach(tId => {
                    if (tId) teacherCounts[tId] = (teacherCounts[tId] || 0) + 1;
                });
            } else if (data.tea) {
                // সাধারণ টিচারদের জন্য
                teacherCounts[data.tea] = (teacherCounts[data.tea] || 0) + 1;
            }
        }
    });

    // ২. সাবজেক্ট ড্যাশবোর্ড (Progress Bars) রেন্ডার করা
    let subHTML = "";
    config.classes.forEach(cls => {
        subHTML += `<div class="card"><strong>Class ${cls}</strong><div style="margin-top:8px">`;
        
        if (config.subjects[cls]) {
            Object.keys(config.subjects[cls]).forEach(subName => {
                let current = subCounts[cls]?.[subName] || 0;
                let target = config.subjects[cls][subName]; // সাপ্তাহিক টার্গেট পিরিয়ড
                let percent = Math.min((current / target) * 100, 100);
                
                // কালার পরিবর্তন: টার্গেট পূরণ হলে সবুজ, নয়তো নীল
                let barColor = percent >= 100 ? '#34a853' : '#1a73e8';

                subHTML += `
                    <div style="font-size:10px; display:flex; justify-content:space-between; margin-bottom:2px;">
                        <span>${subName}</span>
                        <span>${current}/${target}</span>
                    </div>
                    <div style="width:100%; height:6px; background:#eee; border-radius:3px; margin-bottom:8px; overflow:hidden;">
                        <div style="width:${percent}%; height:100%; background:${barColor}; transition: width 0.3s;"></div>
                    </div>`;
            });
        }
        subHTML += `</div></div>`;
    });
    
    const subDash = document.getElementById('subDash');
    if (subDash) subDash.innerHTML = subHTML;

    // ৩. টিচার ড্যাশবোর্ড (Load Cards) রেন্ডার করা
    const teacherDash = document.getElementById('teacherDash');
    if (teacherDash) {
        teacherDash.innerHTML = Object.keys(teachers).map(tId => {
            const load = teacherCounts[tId] || 0;
            const max = teachers[tId].maxLoad || 24;
            const isOverloaded = load > max;
            return `<div class="card" style="text-align:center; border-top: 3px solid ${isOverloaded ? 'red' : '#673ab7'}">
                    <strong style="font-size:14px;">${teachers[tId].name}</strong>
                    <div style="font-size:11px; color:#666;">${tId}</div>
                    <div style="margin-top:5px; font-weight:bold; color:${isOverloaded ? 'red' : '#333'}"> ${load} / ${max} </div>
                </div>`;
        }).join('');
    }
}

function updateConflictUI() {
    document.querySelectorAll('.t-sel').forEach(s => s.classList.remove('conflict-error'));
    config.days.forEach(day => {
        for(let p=1; p<=8; p++) {
            let sels = document.querySelectorAll(`.t-day-${day}.t-p-${p}`);
            let tMap = {};
            sels.forEach(s => { if(s.value) { tMap[s.value] = (tMap[s.value] || 0) + 1; } });
            sels.forEach(s => { if(tMap[s.value] > 1) s.classList.add('conflict-error'); });
        }
    });
}

function updateTeacherDownloadDropdown() {
    const select = document.getElementById('teacher-download-select');  if (!select) return;
    let options = '<option value="">শিক্ষক নির্বাচন করুন</option>';
    
    // শিক্ষকদের কোড অনুযায়ী সর্ট করে লুপ চালানো
    Object.keys(teachers).sort().forEach(tCode => {
        const tName = teachers[tCode].name || "No Name";  // যদি নাম না থাকে তবে ডিফল্ট টেক্সট তৈরি
        options += `<option value="${tCode}">${tCode} - ${tName}</option>`;
    });
    select.innerHTML = options;
}

//Routine Editor, Teacher & Subject and Dashboard - এই 3 Tab এর একটি থেকে আরেকটিতে গেলে কল হয়
function openTab(evt, section) {              
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(section).classList.add('active');
    evt.currentTarget.classList.add('active');
    updateUI();
}

function addAssignment() {
    const clsValue = document.getElementById('assign-cls').value;
    const sub = document.getElementById('subPicker').value;
    if (!sub) {Swal.fire('Error', 'অনুগ্রহ করে একটি বিষয় সিলেক্ট করুন!', 'error'); return;}

    if (clsValue === "all") {                                                                 // config.classes অ্যারে থেকে সব ক্লাস নিয়ে লুপ চালানো
        config.classes.forEach(cls => {
            const exists = tempAssignments.find(a => a.cls == cls && a.sub == sub);         // চেক করা হচ্ছে এই ক্লাস ও বিষয় অলরেডি আছে কি না
            if (!exists) {tempAssignments.push({ cls: cls.toString(), sub: sub });}
        });
        showToast("সব ক্লাসের জন্য " + sub + " যোগ করা হয়েছে", "success");
    } else {
        const exists = tempAssignments.find(a => a.cls == clsValue && a.sub == sub);
        if (exists) { showToast("এই ক্লাস ও বিষয় অলরেডি যোগ করা হয়েছে!", "error"); return; }
        tempAssignments.push({ cls: clsValue, sub: sub });
    }
    renderAssignmentList();
}

function renderAssignmentList() {
    const assignmentListDiv = document.getElementById('assignment-list');
    if (tempAssignments.length === 0) {
        assignmentListDiv.innerHTML = `<p style="font-size: 12px; color: #888;">এখনো কোনো বিষয় যোগ করা হয়নি।</p>`;  return;
    }
    assignmentListDiv.innerHTML = tempAssignments.map((a, index) => `
        <div class="assignment-tag"> Cls ${a.cls}: ${a.sub} <b onclick="removeAssignment(${index})">×</b> </div>
    `).join('');
}

function removeAssignment(index) {tempAssignments.splice(index, 1); renderAssignmentList(); }

function saveTeacher() {
    const name = document.getElementById('tName').value.trim();
    const short = document.getElementById('tShort').value.trim().toUpperCase();
    const trade = document.getElementById('tradeSpec').value;
    const maxLoad = parseInt(document.getElementById('t-max-load').value);

    if (!name || !short) { Swal.fire('Error', 'শিক্ষকের নাম এবং সংক্ষিপ্ত নাম (Short Code) প্রদান করুন!', 'error'); return;}
    if (tempAssignments.length === 0) {Swal.fire('Error', 'অন্তত একটি ক্লাস ও বিষয় বরাদ্দ (Assign) করুন!', 'error'); return;}

    // short code-কে Key হিসেবে ব্যবহার যা শিক্ষকের তথ্য আপডেটে প্রয়োজন হবে
    teachers[short] = {name: name, assignments: [...tempAssignments], trade: trade || null, maxLoad: maxLoad };
    localStorage.setItem('h_teachers', JSON.stringify(teachers));

    renderTList();
    updateUI(); 
    
    // save button এর text & settings পরিবর্তন 
    const saveBtn = document.querySelector('.btnSaveTeacher');
    if (saveBtn) { saveBtn.innerText = "Save Teacher Info"; saveBtn.classList.remove('update-mode'); saveBtn.style.background = ""; }

    // tShort ইনপুট ফিল্ডের ReadOnly স্ট্যাটাস রিসেট করা
    document.getElementById('tShort').readOnly = false; document.getElementById('tShort').style.background = "#fff";

    resetTeacherForm(); showToast("শিক্ষকের তথ্য সফলভাবে সংরক্ষিত ও আপডেট হয়েছে!", "success");
}

function resetTeacherForm() {
    document.getElementById('tName').value = ""; document.getElementById('tShort').value = "";
    document.getElementById('tradeSpec').value = ""; document.getElementById('tradeSpec').style.display = "none";
    document.getElementById('t-max-load').value = 24; tempAssignments = [];
    renderAssignmentList();
}

function editTeacher(id) {
    const t = teachers[id]; if (!t) return;
    console.log(t);
    document.getElementById('tName').value = t.name;   document.getElementById('tShort').value = id;
    document.getElementById('tShort').readOnly = true;                                                  // শর্ট ফর্ম এডিট করা বন্ধ কারণ এটি ডেটাবেসের কী/Key
    document.getElementById('tShort').style.background = "#eee";
    const loadInput = document.getElementById('t-max-load'); if(loadInput) loadInput.value = t.maxLoad || 24;

    tempAssignments = t.assignments ? [...t.assignments] : [];       // তার assignments tempAssignments এ নেওয়া
    renderAssignmentList();                                         // tempAssignments এর data ব্যবহার করে অ্যাসাইনমেন্ট লিস্ট রেন্ডার করা

    //সেভ বাটনের টেক্সট পরিবর্তন করা
    const saveBtn = document.querySelector('.btnSaveTeacher'); 
    if(saveBtn) { saveBtn.innerText = "Update Teacher Info"; saveBtn.classList.add('update-mode');  saveBtn.style.background = "#673AB7";}
    showToast("এডিট মোড চালু হয়েছে (Short Code পরিবর্তনযোগ্য নয়)");
}

function deleteTeacher(id) { 
    if(confirm("আপনি কি এই শিক্ষককে মুছে ফেলতে চান?")) { delete teachers[id];  localStorage.setItem('h_teachers', JSON.stringify(teachers)); 
        renderTList(); updateUI(); showToast("শিক্ষক মুছে ফেলা হয়েছে");                    // লিস্ট আপডেট ও ড্যাশবোর্ড আপডেট
    } 
}

// ১. মেইন ফাংশন যা ড্রপডাউন চেঞ্জ করলে কল হয়
async function subChg(el) {
    const td = el.closest('td');
    const tr = el.closest('tr');
    const day = tr.dataset.day;
    const cls = tr.dataset.cls;
    const sec = tr.dataset.sec;
    const sub = el.value;
    const ts = td.querySelector('.t-sel');
    const p = parseInt(td.id.split('-p')[1]);

    // আগের ইনভ্যালিড সিলেকশন মার্ক মুছে ফেলা
    td.classList.remove('invalid-selection');
    td.querySelectorAll('.trade-selector-container').forEach(e => e.remove());

    // যদি সাবজেক্ট খালি করা হয় (None সিলেক্ট করলে)
    if (sub === "") {ts.style.display = 'block'; ts.innerHTML = '<option value="">---</option>'; manualSave(); return;
    }

    let bSize = 1; // ডিফল্ট ১ পিরিয়ড

    // --- শর্ত ৩, ৪ ও ৫: ব্যবহারিক ক্লাসের ব্লক সাইজ নির্ধারণ ---
    if (sub === "ICT" || sub === "Drawing") { bSize = 2;  processSubPlacement(el, bSize);
    } 
    else if (sub === "Work" || sub.includes("Trade")) {
        const result = await Swal.fire({title: sub + ' : ক্লাস টাইপ?', text: "আপনি কি এই বিষয়ের ৩ পিরিয়ডের ব্যবহারিক (Practical) ক্লাস বসাতে চান?", icon: 'question',
            showCancelButton: true, confirmButtonText: 'হ্যাঁ, ৩ পিরিয়ড', cancelButtonText: 'না, ১ পিরিয়ড (তাত্ত্বিক)', 
            confirmButtonColor: '#1a73e8', cancelButtonColor: '#6c757d', allowOutsideClick: false
        });
        bSize = result.isConfirmed ? 3 : 1;
        processSubPlacement(el, bSize);
    } 
    else {processSubPlacement(el, bSize);}
}

function processSubPlacement(el, bSize) {
    const td = el.closest('td');
    const tr = el.closest('tr');
    const day = tr.dataset.day;
    const cls = tr.dataset.cls;
    const sec = tr.dataset.sec;
    const sub = el.value;
    const p = parseInt(td.id.split('-p')[1]);

    // অ্যাডভান্সড রুল চেক করা (আপনার দেওয়া ৯টি শর্ত এখানে চেক হবে)
    let res = checkManualAdvancedRule(cls, sec, p, sub, bSize, day);

    if (!res.possible) {
        // শর্ত না মিললে SweetAlert2 দিয়ে এরর দেখানো
        Swal.fire({ icon: 'error', title: 'দুঃখিত!', text: res.msg,  confirmButtonColor: '#d33', timer: 2000 });
        
        el.value = ""; // ড্রপডাউন রিসেট
        return;
    }

    // --- মেইন লজিক: পরের পিরিয়ডগুলো অটো-ফিল করা ---
    if (sub === "Trade1" || sub === "Trade2") {
        // শর্ত ৯: ট্রেড হলে ৪টি ড্রপডাউন সেটআপ
        for (let i = 0; i < bSize; i++) {
            let targetTd = document.getElementById(`${day}-${cls}-${sec}-p${p + i}`);
            if (targetTd) {
                targetTd.querySelector('.sub-sel').value = sub;
                let targetTs = targetTd.querySelector('.t-sel');
                if (targetTs) targetTs.style.display = 'none';
                setupTradeCell(targetTd, sub);
            }
        }
    } else {
        // সাধারণ বিষয় বা ICT/Drawing এর জন্য
        for (let i = 0; i < bSize; i++) {
            let targetTd = document.getElementById(`${day}-${cls}-${sec}-p${p + i}`);
            if (targetTd) {
                targetTd.querySelector('.sub-sel').value = sub;
                let targetTs = targetTd.querySelector('.t-sel');
                if (targetTs) {
                    targetTs.style.display = 'block';
                    targetTs.innerHTML = getTOpts(sub, res.teacher);
                    targetTs.value = res.teacher;
                }
            }
        }
    }
    manualSave(); // ডাটা সেভ করা
}

function checkManualAdvancedRule(cls, sec, p, sub, block, day) {
    const currentCellId = `${day}-${cls}-${sec}-p${p}`;

    // ১. টিচার লিস্ট ও ট্রেড এভেইল্যাবিলিটি চেক (শর্ত ৯ ও ১)
    const teacherList = Object.keys(teachers).filter(tId => 
        teachers[tId].assignments.some(a => a.cls == cls && a.sub === sub)
    );

    if (sub === "Trade1" || sub === "Trade2") {
        const trades = ['A', 'C', 'E', 'W'];
        for (let tr of trades) {
            // ওই নির্দিষ্ট ট্রেডের কোনো শিক্ষক এই পিরিয়ডগুলোতে ফ্রি আছে কিনা
            let freeTeacherForThisTrade = Object.keys(teachers).some(tId => {
                let t = teachers[tId];
                if (t.trade === tr && t.assignments.some(a => a.sub === sub)) {
                    let busy = false;
                    for (let i = 0; i < block; i++) {
                        let cp = p + i;
                        // সব টিচার ড্রপডাউন এবং ট্রেড ড্রপডাউন চেক
                        let busyInAnySec = Array.from(document.querySelectorAll('.t-sel, .trade-mini-sel')).some(s => {
                            let td = s.closest('td');
                            return td.id.startsWith(day) && td.id.endsWith(`-p${cp}`) && s.value === tId;
                        });
                        if (busyInAnySec) { busy = true; break; }
                    }
                    return !busy;
                }
                return false;
            });

            if (!freeTeacherForThisTrade) {
                return { possible: false, msg: `${sub}: ট্রেড ${tr} এর কোনো শিক্ষক এই সময়ে ফ্রি নেই বা এই ট্রেডে কোনো শিক্ষক বরাদ্দ নেই!` };
            }
        }
    } else {
        if (teacherList.length === 0) return { possible: false, msg: "এই বিষয়ের কোনো শিক্ষক বরাদ্দ নেই!" };
    }

    // ২. এক দিনে একই সাবজেক্ট এবং ব্যবহারের ক্লাসের সংখ্যা চেক (শর্ত ৬ ও ৮)
    const row = document.querySelector(`tr[data-day="${day}"][data-cls="${cls}"][data-sec="${sec}"]`);
    let subAlreadyExists = false;
    let practicalAlreadyExists = false;

    row.querySelectorAll('td').forEach(td => {
        if (td.id !== currentCellId) {
            const sel = td.querySelector('.sub-sel');
            const val = sel ? sel.value : "";
            if (val === sub) subAlreadyExists = true; 
            if (["Work", "ICT", "Drawing"].includes(val) || val.includes("Trade")) {
                practicalAlreadyExists = true;
            }
        }
    });

    if (subAlreadyExists) return { possible: false, msg: sub + " আজ অলরেডি একবার বসানো হয়েছে।" };
    if (block >= 2 && practicalAlreadyExists) return { possible: false, msg: "দিনে একটির বেশি ব্যবহারিক ক্লাস বসানো যাবে না।" };

    // ৩. সাপ্তাহিক লোড চেক (শর্ত ২ ও ৩)
    let currentWeeklyCount = 0;
    // পুরো রুটিনে এই সেকশনের এই সাবজেক্টটি কত পিরিয়ড আছে তা গণনা
    document.querySelectorAll(`td[id*="-${cls}-${sec}-p"]`).forEach(td => {
        if (td.id !== currentCellId) {
            const sel = td.querySelector('.sub-sel');
            if (sel && sel.value === sub) currentWeeklyCount++;
        }
    });

    let maxAllowed = config.subjects[cls][sub] || 0;
    if ((currentWeeklyCount + block) > maxAllowed) {
        return { possible: false, msg: `সাপ্তাহিক লোড লিমিট (${maxAllowed}) অতিক্রম করছে। বর্তমানে আছে: ${currentWeeklyCount}` };
    }

    // ৪. পিরিয়ড সীমা ও টিফিন ব্রেক চেক (শর্ত ৫)
    let startP = parseInt(p);
    let endP = startP + block - 1;
    let maxP = (cls <= 8) ? 6 : 8;

    if (endP > maxP) return { possible: false, msg: `পিরিয়ড সীমার বাইরে! এই ক্লাস ${maxP} পিরিয়ডের মধ্যে শেষ হতে হবে।` };
    if (block > 1 && startP <= 4 && endP > 4) {
        return { possible: false, msg: "ব্যবহারিক ক্লাসের মাঝে টিফিন ব্রেক (৪র্থ পিরিয়ড পর) পড়া যাবে না!" };
    }

    // ৫. পরবর্তী পিরিয়ডগুলো খালি আছে কি না চেক
    for (let i = 1; i < block; i++) {
        let cp = startP + i;
        let nextTd = document.getElementById(`${day}-${cls}-${sec}-p${cp}`);
        if (nextTd && nextTd.querySelector('.sub-sel').value !== "") {
            return { possible: false, msg: `পরবর্তী ${cp} পিরিয়ডটি খালি নেই!` };
        }
    }

    // ৬. ICT ল্যাব কনফ্লিক্ট চেক (শর্ত ৭)
    if (sub === "ICT") {
        for (let i = 0; i < block; i++) {
            let cp = startP + i;
            let labInUse = Array.from(document.querySelectorAll(`tr[data-day="${day}"] .sub-sel`)).some(sel => {
                let td = sel.closest('td');
                return !td.id.includes(`-${cls}-${sec}-`) && td.id.includes(`-p${cp}`) && sel.value === "ICT";
            });
            if (labInUse) return { possible: false, msg: `পিরিয়ড ${cp}: অন্য সেকশনে বর্তমানে ICT ল্যাব ব্যবহৃত হচ্ছে!` };
        }
    }

    // ৭. সাধারণ টিচার এভেইল্যাবিলিটি ও লোড ব্যালেন্সিং (শর্ত ১)
    if (sub !== "Trade1" && sub !== "Trade2") {
        let bestTeacher = null;
        let minLoad = Infinity;

        for (let tCode of teacherList) {
            let isBusy = false;
            for (let i = 0; i < block; i++) {
                let cp = startP + i;
                // ওই পিরিয়ডে শিক্ষক অন্য কোনো সেকশনে (টিচার সেল বা ট্রেড সেলে) ব্যস্ত কিনা
                let busy = Array.from(document.querySelectorAll('.t-sel, .trade-mini-sel')).some(s => {
                    let td = s.closest('td');
                    return td.id.startsWith(day) && td.id.endsWith(`-p${cp}`) && s.value === tCode;
                });
                if (busy) { isBusy = true; break; }
            }

            if (!isBusy) {
                let load = getTeacherLoad(tCode);
                if (load < minLoad) {
                    minLoad = load;
                    bestTeacher = tCode;
                }
            }
        }

        if (!bestTeacher) return { possible: false, msg: "এই বিষয়ের সকল শিক্ষক এই সময়ে অন্য ক্লাসে ব্যস্ত!" };
        return { possible: true, teacher: bestTeacher };
    }

    return { possible: true }; 
}

function setupTradeCell(td, sub, currentDayPlan = {}) {
    // আগের কোনো ড্রপডাউন থাকলে তা মুছে ফেলা
    const oldContainer = td.querySelector('.trade-selector-container');
    if (oldContainer) oldContainer.remove();
    
    const parts = td.id.split('-'); 
    const day = parts[0];
    const p = parts[parts.length - 1].replace('p', ''); 

    // আমাদের ৪টি ফিক্সড ট্রেড কোড
    const trades = ['A', 'C', 'E', 'W'];
    
    let container = document.createElement('div');
    container.className = 'trade-selector-container';
    
    // UI স্টাইল: ২ কলামের গ্রিড যাতে ছোট জায়গায় ৪টি ড্রপডাউন ধরে
    container.style.cssText = `
        display: grid; 
        grid-template-columns: 1fr 1fr; 
        gap: 3px; 
        margin-top: 4px; 
        background: #f1f8ff; 
        padding: 3px; 
        border-radius: 4px; 
        border: 1px solid #90caf9;
    `;

    trades.forEach(trCode => {
        let sel = document.createElement('select');
        sel.className = 'trade-mini-sel';
        sel.dataset.trade = trCode;
        sel.style.cssText = "font-size: 10px; width: 100%; padding: 1px; border: 1px solid #999; border-radius: 2px;";
        
        // ১. ওই ট্রেডের পটেনশিয়াল শিক্ষক ফিল্টার করা (যাদের assignments-এ এই বিষয় আছে)
        let potentialTeachers = Object.keys(teachers).filter(tCode => {
            const t = teachers[tCode];
            return t.trade === trCode && t.assignments.some(a => a.sub === sub);
        });

        // ২. ওই পিরিয়ডে কারা ফ্রি আছেন তা চেক করা
        let freeTeachers = potentialTeachers.filter(tCode => {
            // storage (routineData) এবং memory (currentDayPlan) উভয় জায়গায় চেক
            const allActiveData = { ...routineData, ...currentDayPlan };
            
            let isBusy = Object.keys(allActiveData).some(id => {
                const data = allActiveData[id];
                return id.startsWith(day) && 
                       id.endsWith(`-p${p}`) && 
                       (data.tea === tCode || (Array.isArray(data.tea) && data.tea.includes(tCode)));
            });
            
            return !isBusy;
        });

        // ৩. লোড অনুযায়ী সর্ট করা (যাদের ক্লাস কম তাদের আগে দেখানো)
        freeTeachers.sort((a, b) => getTeacherLoad(a) - getTeacherLoad(b));

        // ৪. ড্রপডাউন অপশন তৈরি
        let options = `<option value="">--${trCode}--</option>`;
        freeTeachers.forEach(tCode => {
            const tName = teachers[tCode].name;
            options += `<option value="${tCode}" title="${tName}">${tCode}</option>`;
        });
        
        sel.innerHTML = options;

        // ৫. যদি ফ্রি শিক্ষক থাকে, তবে প্রথমজনকে ডিফল্টভাবে সিলেক্ট করা (অটো-ফিলের জন্য)
        if (freeTeachers.length > 0) {
            sel.value = freeTeachers[0];
        } else {
            sel.style.background = "#ffebee"; // কোনো শিক্ষক না থাকলে লালচে ভাব
        }
        
        // পরিবর্তন হলে সেভ করা
        sel.onchange = () => { 
            manualSave(); 
            updateUI(); 
            updateConflictUI(); 
        };
        
        container.appendChild(sel);
    });
    
    td.appendChild(container);
}

function generateDay() {
    const day = document.getElementById('targetDay').value;
    if(Object.keys(teachers).length === 0) { alert("Add teachers first!"); return;}
    runAutoFill(day);  manualSave(); showToast("Generated for " + day);
}

function runAutoFill(day) {
   
    let dayPlan = {};                                                             // ১. এই দিনের জন্য একটি অস্থায়ী ডাটা স্টোর (যাতে সব সেকশন একে অপরের ডাটা দেখতে পারে)
    Object.keys(teachers).forEach(tCode => { currentTeacherLoad[tCode] = 0; });  // ২. টিচারদের লোড ট্র্যাকিং অবজেক্ট (শুরুতে সবার লোড ০)

    // ৩. বর্তমানে routineData-তে থাকা আগের সেভ করা ক্লাসগুলোর লোড যোগ করা
    Object.values(routineData).forEach(data => {
        if (data.tea) {
            if (Array.isArray(data.tea)) {
                data.tea.forEach(t => { if(currentTeacherLoad[t] !== undefined) currentTeacherLoad[t]++; });
            } else {
                if(currentTeacherLoad[data.tea] !== undefined) currentTeacherLoad[data.tea]++;
            }
        }
    });

    // ৪. ক্লাস এবং সেকশনগুলোকে এলোমেলো (Shuffle) করা যাতে রুটিন বৈচিত্র্যময় হয়
    let classes = [...config.classes].sort(() => Math.random() - 0.5);
    let sections = [...config.sections].sort(() => Math.random() - 0.5);

    classes.forEach(cls => {
        sections.forEach(sec => {
            // ৫. এই সেকশনের জন্য কোন কোন সাবজেক্ট কতটুকু বাকি আছে তার লিস্ট তৈরি
            let subjectsNeeded = [];
            Object.keys(config.subjects[cls]).forEach(sub => {
                
                // routineData এবং বর্তমান dayPlan মিলিয়ে এই সাবজেক্ট কয়বার আছে দেখা
                let currentCount = Object.values({...routineData, ...dayPlan}).filter(data => 
                    data.cls == cls && data.sec == sec && data.sub === sub
                ).length;
                
                let remaining = config.subjects[cls][sub] - currentCount;
                if (sub === "ICT" || sub === "Drawing") {
                    // শর্ত ৪: শুধু ২ পিরিয়ডের প্র্যাকটিক্যাল
                    for (let i = 0; i < remaining; i += 2) {
                        subjectsNeeded.push({ name: sub, size: 2 });
                    }
                } else if (sub === "Work" || sub.includes("Trade")) {
                    // শর্ত ৩: ৮ পিরিয়ডের মধ্যে ২টি ৩-পিরিয়ড এবং ২টি ১-পিরিয়ড
                    // আমরা প্রথমে বড় ব্লক (৩ পিরিয়ড) গুলো পুশ করবো যাতে সেগুলো আগে বসে
                    if (remaining >= 3) {
                        subjectsNeeded.push({ name: sub, size: 3 });
                        remaining -= 3;
                    }
                    if (remaining >= 3) {
                        subjectsNeeded.push({ name: sub, size: 3 });
                        remaining -= 3;
                    }
                    // বাকিগুলো ১ পিরিয়ডের তাত্ত্বিক ক্লাস
                    for (let i = 0; i < remaining; i++) {
                        subjectsNeeded.push({ name: sub, size: 1 });
                    }
                } else {
                    // সাধারণ বিষয় (১ পিরিয়ড)
                    for (let i = 0; i < remaining; i++) {
                        subjectsNeeded.push({ name: sub, size: 1 });
                    }
                }
            });

            // ৬. পিরিয়ড অনুযায়ী ক্লাস বসানো শুরু (১ থেকে ৬ বা ৮ পিরিয়ড)
            for (let p = 1; p <= (cls <= 8 ? 6 : 8); p++) {
                const tdId = `${day}-${cls}-${sec}-p${p}`;
                const td = document.getElementById(tdId);
                
                // যদি পিরিয়ডটি অলরেডি পূর্ণ থাকে তবে স্কিপ
                if (!td || td.querySelector('.sub-sel').value !== "" || dayPlan[tdId]) continue;

                // সাবজেক্ট লিস্ট এলোমেলো করা
                subjectsNeeded.sort(() => Math.random() - 0.5);

                for (let j = 0; j < subjectsNeeded.length; j++) {
                    let item = subjectsNeeded[j];
                    
                    // ৭. শর্ত যাচাই (checkAdvancedRule এ dayPlan পাঠানো হচ্ছে)
                    let res = checkAdvancedRule(cls, sec, p, item.name, item.size, day, currentTeacherLoad, dayPlan);

                    if (res.possible) {
                        // ৮. সফল হলে ব্লক অনুযায়ী সব পিরিয়ড ফিল করা
                        for (let k = 0; k < item.size; k++) {
                            let targetId = `${day}-${cls}-${sec}-p${p + k}`;
                            let targetTd = document.getElementById(targetId);
                            
                            if (targetTd) {
                                // UI আপডেট (সাবজেক্ট সিলেক্ট করা)
                                targetTd.querySelector('.sub-sel').value = item.name;
                                let tSel = targetTd.querySelector('.t-sel');
                                
                                if (item.name === "Trade1" || item.name === "Trade2") {
                                    // ট্রেড হলে ৪টি ড্রপডাউন সেটআপ
                                    if(tSel) tSel.style.display = 'none';
                                    setupTradeCell(targetTd, item.name, dayPlan);
                                    
                                    // ট্রেড শিক্ষকদের লোড বাড়ানো
                                    const trades = ['A', 'C', 'E', 'W'];
                                    trades.forEach(trCode => {
                                        let assignedT = Object.keys(teachers).find(tId => 
                                            teachers[tId].trade === trCode && 
                                            teachers[tId].assignments.some(a => a.sub === item.name)
                                        );
                                        if (assignedT) currentTeacherLoad[assignedT]++;
                                    });
                                    // dayPlan-এ ট্রেড ডাটা সেভ
                                    dayPlan[targetId] = { sub: item.name, tea: trades, cls: cls, sec: sec };
                                } else {
                                    // সাধারণ বিষয় হলে টিচার সিলেক্ট করা
                                    if(tSel) {
                                        tSel.style.display = 'block';
                                        tSel.innerHTML = getTOpts(item.name, res.teacher);
                                        tSel.value = res.teacher;
                                        currentTeacherLoad[res.teacher]++;
                                    }
                                    // dayPlan-এ সাধারণ ডাটা সেভ
                                    dayPlan[targetId] = { sub: item.name, tea: res.teacher, cls: cls, sec: sec };
                                }
                            }
                        }
                        // ৯. লিস্ট থেকে সাবজেক্টটি সরিয়ে ফেলা এবং লুপ পজিশন আপডেট
                        subjectsNeeded.splice(j, 1);
                        p += (item.size - 1);
                        break;
                    }
                }
            }
        });
    });

    // ১০. সব কাজ শেষ হলে ডাটা স্থায়ীভাবে সেভ করা
    manualSave(); 
    showToast(`Generated successfully for ${day}`);
}

function getTeacherLoad(tCode) {
    let count = 0;
    // routineData থেকে চেক
    Object.values(routineData).forEach(d => {
        if (Array.isArray(d.tea)) { if (d.tea.includes(tCode)) count++; }
        else { if (d.tea === tCode) count++; }
    });
    return count;
}

function checkAdvancedRule(cls, sec, p, sub, block, day, currentTeacherLoad, dayPlan) {
    
    // সব ডাটা একীভূত করে দেখা (আগের সেভ করা ডাটা + বর্তমান অটো-ফিলের ডাটা)
    const allData = { ...routineData, ...dayPlan };

    // ১. পটেনশিয়াল টিচার লিস্ট
    const potentialTeachers = Object.keys(teachers).filter(tId => 
        teachers[tId].assignments.some(a => a.cls == cls && a.sub === sub)
    );

    // ২. ট্রেড শিক্ষক চেক (A, C, E, W)
    if (sub === "Trade1" || sub === "Trade2") {
        const trades = ['A', 'C', 'E', 'W'];
        let allTradesHaveTeacher = true;
        for (let tr of trades) {
            // চেক করা হচ্ছে এই ট্রেডের (A/C/E/W) অন্তত একজন শিক্ষক এই পিরিয়ডে ফ্রি কি না
            let freeTeacherForTrade = Object.keys(teachers).some(tId => {
                let t = teachers[tId];
                if (t.trade === tr && t.assignments.some(a => a.sub === sub)) {
                    let isBusy = false;
                    for (let i = 0; i < block; i++) {
                        let cp = p + i;
                        // allData (memory) এবং routineData (storage) উভয় জায়গায় চেক
                        let busy = Object.keys(allData).some(id => 
                            id.startsWith(day) && id.endsWith(`-p${cp}`) && 
                            (allData[id].tea === tId || (Array.isArray(allData[id].tea) && allData[id].tea.includes(tId)))
                        );
                        if (busy) { isBusy = true; break; }
                    }
                    return !isBusy;
                }
                return false;
            });

            if (!freeTeacherForTrade) {
                allTradesHaveTeacher = false;
                break; // একটি ট্রেডের টিচার না থাকলে আর চেক করার দরকার নেই
            }
        }
        if (!allTradesHaveTeacher) return { possible: false, msg: "৪টি ট্রেডের ৪ জন শিক্ষক ফ্রি নেই" };
    }

    // ৩. সাপ্তাহিক লোড চেক (সরাসরি allData থেকে)
    let weeklyCount = Object.values(allData).filter(data => 
        data.cls == cls && data.sec == sec && data.sub === sub
    ).length;

    let maxWeekly = config.subjects[cls][sub] || 0;
    if ((weeklyCount + block) > maxWeekly) return { possible: false, msg: "সাপ্তাহিক লিমিট শেষ" };

    // ৪. দৈনিক ক্লাসের ধরণ চেক (allData থেকে)
    let daySubCount = 0; 
    let hasPracticalToday = false; 

    Object.keys(allData).forEach(id => {
        if (id.startsWith(`${day}-${cls}-${sec}-`)) {
            const data = allData[id];
            if (data.sub === sub) daySubCount++;
            if (["Work", "ICT", "Drawing"].includes(data.sub) || data.sub.includes("Trade")) hasPracticalToday = true;
        }
    });

    if (block >= 2 && hasPracticalToday) return { possible: false, msg: "দিনে ২টি প্র্যাকটিক্যাল নয়" };
    if (block === 1 && daySubCount >= 1) return { possible: false, msg: "তাত্ত্বিক ক্লাস একবার হয়ে গেছে" };

    // ৫. টিফিন ও পিরিয়ড লিমিট
    let startP = parseInt(p);
    let endP = startP + block - 1;
    let maxP = (cls <= 8) ? 6 : 8;

    if (endP > maxP) return { possible: false }; 
    if (block > 1 && startP <= 4 && endP > 4) return { possible: false, msg: "টিফিন ব্রেক কনফ্লিক্ট" }; 

    // পিরিয়ড খালি আছে কি না (allData থেকে)
    for (let i = 1; i < block; i++) {
        const checkId = `${day}-${cls}-${sec}-p${startP + i}`;
        if (allData[checkId] && allData[checkId].sub !== "") return { possible: false };
    }

    // ৬. ICT ল্যাব কনফ্লিক্ট (allData থেকে)
    if (sub === "ICT") {
        for (let i = 0; i < block; i++) {
            let cp = startP + i;
            let labInUse = Object.keys(allData).some(id => 
                id.startsWith(day) && !id.includes(`-${cls}-${sec}-`) && 
                id.endsWith(`-p${cp}`) && allData[id].sub === "ICT"
            );
            if (labInUse) return { possible: false, msg: "ল্যাব বিজি" };
        }
    }

    // ৭. সাধারণ টিচার ও লোড ব্যালেন্সিং
    if (sub !== "Trade1" && sub !== "Trade2") {
        let bestTeacher = null;
        let minLoad = Infinity;

        for (let tCode of potentialTeachers) {
            let isBusy = false;
            for (let i = 0; i < block; i++) {
                let cp = startP + i;
                let busyInAnySec = Object.keys(allData).some(id => 
                    id.startsWith(day) && id.endsWith(`-p${cp}`) && 
                    (allData[id].tea === tCode || (Array.isArray(allData[id].tea) && allData[id].tea.includes(tCode)))
                );
                if (busyInAnySec) { isBusy = true; break; }
            }

            if (!isBusy) {
                let load = currentTeacherLoad[tCode] || 0;
                if (load < minLoad) {
                    minLoad = load;
                    bestTeacher = tCode;
                }
            }
        }
        if (bestTeacher) return { possible: true, teacher: bestTeacher };
        return { possible: false };
    }

    return { possible: true };
}

function manualSave() {
    const updatedData = {}; 
    document.querySelectorAll('.routine-cell').forEach(td => {
        const subSel = td.querySelector('.sub-sel');
        if (!subSel || subSel.value === "") return; 

        const sub = subSel.value;
        const parts = td.id.split('-'); // দিন-ক্লাস-সেকশন-পিরিয়ড
        
        let teachersSelected;
        if (sub === "Trade1" || sub === "Trade2") {
            teachersSelected = Array.from(td.querySelectorAll('.trade-mini-sel'))
                                    .map(s => s.value)
                                    .filter(v => v !== "");
        } else {
            const tSel = td.querySelector('.t-sel');
            teachersSelected = tSel ? tSel.value : "";
        }

        // ডাটা অবজেক্টে cls এবং sec আলাদাভাবে রাখা ভালো
        updatedData[td.id] = { 
            sub: sub, 
            tea: teachersSelected,
            cls: parts[1], 
            sec: parts[2] 
        };
    });
    routineData = updatedData; 
    localStorage.setItem('h_routine', JSON.stringify(routineData));
    updateUI(); // UI রিফ্রেশ করা
}

async function downloadExcel() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Routine_Full');

    worksheet.columns = [
        { header: 'Day', key: 'day', width: 12 },
        { header: 'Class', key: 'cls', width: 10 },
        { header: 'Sec', key: 'sec', width: 8 },
        { header: 'P1', key: 'p1', width: 20 },
        { header: 'P2', key: 'p2', width: 20 },
        { header: 'P3', key: 'p3', width: 20 },
        { header: 'P4', key: 'p4', width: 20 },
        { header: 'Break', key: 'brk', width: 8 },
        { header: 'P5', key: 'p5', width: 20 },
        { header: 'P6', key: 'p6', width: 20 },
        { header: 'P7', key: 'p7', width: 20 },
        { header: 'P8', key: 'p8', width: 20 }
    ];

    let rowIdx = 2;
    config.days.forEach(day => {
        config.classes.forEach(cls => {
            config.sections.forEach(sec => {
                let rowData = { day: day, cls: 'Class ' + cls, sec: sec, brk: 'BREAK' };
                [1,2,3,4,5,6,7,8].forEach(p => {
                    const cellTd = document.getElementById(`${day}-${cls}-${sec}-p${p}`);
                    if(cellTd) {
                        const s = cellTd.querySelector('.sub-sel').value;
                        if (s === "Trade1" || s === "Trade2") {
                            let tList = [];
                            cellTd.querySelectorAll('.trade-mini-sel').forEach(ms => {
                                if(ms.value) tList.push(ms.value);
                            });
                            rowData['p'+p] = s + "\n(" + (tList.length > 0 ? tList.join(',') : 'No Teacher') + ")";
                        } else {
                            const t = cellTd.querySelector('.t-sel').value;
                            rowData['p'+p] = s ? `${s} (${t})` : '-';
                        }
                    } else {
                        rowData['p'+p] = 'X';
                    }
                });
                worksheet.addRow(rowData);
                worksheet.getRow(rowIdx).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                rowIdx++;
            });
        });
    });

    let mStart = 2;
    config.days.forEach(() => {
        worksheet.mergeCells(`A${mStart}:A${mStart + 9}`); 
        for(let j=0; j<5; j++) {
            let cS = mStart + (j * 2);
            worksheet.mergeCells(`B${cS}:B${cS + 1}`); 
        }
        mStart += 10;
    });

    worksheet.getRow(1).font = { bold: true, color: {argb:'FFFFFF'} };
    worksheet.getRow(1).fill = { type:'pattern', pattern:'solid', fgColor:{argb:'1A73E8'} };

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Vocational_Routine_Export.xlsx`);
}

async function downloadTeacherExcel() {
    const tCode = document.getElementById('teacher-download-select').value;
    
    if (!tCode) {
        Swal.fire('Error', 'অনুগ্রহ করে একজন শিক্ষক সিলেক্ট করুন!', 'error');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${tCode}_Routine`);

    // কলাম সেটআপ
    worksheet.columns = [
        { header: 'Day', key: 'day', width: 12 },
        { header: 'Class', key: 'cls', width: 10 },
        { header: 'Sec', key: 'sec', width: 8 },
        { header: 'P1', key: 'p1', width: 18 },
        { header: 'P2', key: 'p2', width: 18 },
        { header: 'P3', key: 'p3', width: 18 },
        { header: 'P4', key: 'p4', width: 18 },
        { header: 'Break', key: 'brk', width: 8 },
        { header: 'P5', key: 'p5', width: 18 },
        { header: 'P6', key: 'p6', width: 18 },
        { header: 'P7', key: 'p7', width: 18 },
        { header: 'P8', key: 'p8', width: 18 }
    ];

    let rowIdx = 2;
    config.days.forEach(day => {
        config.classes.forEach(cls => {
            config.sections.forEach(sec => {
                let rowData = { day: day, cls: 'Class ' + cls, sec: sec, brk: 'BREAK' };
                
                [1, 2, 3, 4, 5, 6, 7, 8].forEach(p => {
                    const cellTd = document.getElementById(`${day}-${cls}-${sec}-p${p}`);
                    rowData['p' + p] = '-'; // ডিফল্ট ভ্যালু

                    if (cellTd) {
                        const subValue = cellTd.querySelector('.sub-sel').value;
                        let isThisTeacher = false;

                        // সাধারণ শিক্ষক চেক
                        const tSel = cellTd.querySelector('.t-sel');
                        if (tSel && tSel.value === tCode) isThisTeacher = true;

                        // ট্রেড শিক্ষক চেক
                        cellTd.querySelectorAll('.trade-mini-sel').forEach(ms => {
                            if (ms.value === tCode) isThisTeacher = true;
                        });

                        if (isThisTeacher && subValue) {
                            rowData['p' + p] = subValue; 
                        }
                    }
                });

                // এখন ক্লাস থাকুক বা না থাকুক, রো যোগ হবে (যাতে স্ট্রাকচার ঠিক থাকে)
                worksheet.addRow(rowData);
                const row = worksheet.getRow(rowIdx);
                row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

                // শুধুমাত্র এই শিক্ষকের ক্লাস থাকলে সেলটি হাইলাইট করা
                [1, 2, 3, 4, 5, 6, 7, 8].forEach(p => {
                    if (rowData['p' + p] !== '-' && rowData['p' + p] !== '') {
                        // কলাম ইনডেক্স বের করা (ExcelJS এ কলাম ১ থেকে শুরু হয়)
                        // A=1, B=2, C=3, P1=4... Break=8, P5=9...
                        let colIdx = (p <= 4) ? (p + 3) : (p + 4);
                        row.getCell(colIdx).fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'C8E6C9' } // হালকা সবুজ হাইলাইট
                        };
                        row.getCell(colIdx).font = { bold: true };
                    }
                });

                rowIdx++;
            });
        });
    });

    // --- মার্জিং লজিক (প্রথম ফাংশনের মতো হুবহু) ---
    let mStart = 2;
    config.days.forEach(() => {
        // দিন মার্জ (ধরি ১০টি করে রো আছে আপনার কনফিগারেশনে)
        const rowsPerDay = config.classes.length * config.sections.length;
        worksheet.mergeCells(`A${mStart}:A${mStart + rowsPerDay - 1}`); 
        
        // ক্লাস মার্জ
        for(let j = 0; j < config.classes.length; j++) {
            let cS = mStart + (j * config.sections.length);
            worksheet.mergeCells(`B${cS}:B${cS + config.sections.length - 1}`); 
        }
        mStart += rowsPerDay;
    });

    // হেডার স্টাইল
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4527A0' } };

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Teacher_Routine_${tCode}.xlsx`);
}

async function downloadClassExcel() {
    const clsCode = document.getElementById('class-download-select').value;
    if (!clsCode) {Swal.fire('Error', 'অনুগ্রহ করে একটি শ্রেণি সিলেক্ট করুন!', 'error'); return;}

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Class_${clsCode}_Routine`);

    // কলাম সেটআপ
    worksheet.columns = [
        { header: 'Day', key: 'day', width: 12 },
        { header: 'Class', key: 'cls', width: 10 },
        { header: 'Sec', key: 'sec', width: 8 },
        { header: 'P1', key: 'p1', width: 22 },
        { header: 'P2', key: 'p2', width: 22 },
        { header: 'P3', key: 'p3', width: 22 },
        { header: 'P4', key: 'p4', width: 22 },
        { header: 'Break', key: 'brk', width: 8 },
        { header: 'P5', key: 'p5', width: 22 },
        { header: 'P6', key: 'p6', width: 22 },
        { header: 'P7', key: 'p7', width: 22 },
        { header: 'P8', key: 'p8', width: 22 }
    ];

    let rowIdx = 2;
    config.days.forEach(day => {
        // শুধুমাত্র সিলেক্ট করা ক্লাসের জন্য লুপ চলবে
        config.sections.forEach(sec => {
            let rowData = { day: day, cls: 'Class ' + clsCode, sec: sec, brk: 'BREAK' };
            
            [1, 2, 3, 4, 5, 6, 7, 8].forEach(p => {
                const cellTd = document.getElementById(`${day}-${clsCode}-${sec}-p${p}`);
                if (cellTd) {
                    const sub = cellTd.querySelector('.sub-sel').value;
                    
                    if (sub === "Trade1" || sub === "Trade2") {
                        let tList = [];
                        cellTd.querySelectorAll('.trade-mini-sel').forEach(ms => {
                            if (ms.value) tList.push(ms.value);
                        });
                        rowData['p' + p] = sub + "\n(" + (tList.length > 0 ? tList.join(',') : 'No Teacher') + ")";
                    } else {
                        const tSel = cellTd.querySelector('.t-sel');
                        const t = tSel ? tSel.value : "";
                        rowData['p' + p] = sub ? `${sub}\n(${t})` : '-';
                    }
                } else {
                    rowData['p' + p] = '-';
                }
            });

            worksheet.addRow(rowData);
            worksheet.getRow(rowIdx).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            rowIdx++;
        });
    });

    // --- মার্জিং লজিক (শ্রেণি ভিত্তিক) ---
    let mStart = 2;
    const sectionsCount = config.sections.length; // প্রতি দিনের জন্য যতগুলো সেকশন আছে

    config.days.forEach(() => {
        // দিন মার্জ করা (এক দিনে ওই ক্লাসের যতগুলো সেকশন আছে সব মিলে)
        worksheet.mergeCells(`A${mStart}:A${mStart + sectionsCount - 1}`); 
        
        // ক্লাস কলাম (B) মার্জ করা
        worksheet.mergeCells(`B${mStart}:B${mStart + sectionsCount - 1}`); 
        
        mStart += sectionsCount;
    });

    // হেডার স্টাইল (অন্যান্য রুটিন থেকে আলাদা রঙ - নীলচে সবুজ)
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '00796B' } };

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Class_${clsCode}_Routine.xlsx`);
}

function showToast(message, icon = 'info') {
    const Toast = Swal.mixin({toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true});
    Toast.fire({ icon: icon, title: message});
}

function showTooltip(e, td) {
    const tr = td.closest('tr');
    const cls = tr.dataset.cls;
    const sec = tr.dataset.sec;
    const currentSub = td.querySelector('.sub-sel').value;
    
    let usage = {};
    document.querySelectorAll(`tr[data-cls="${cls}"][data-sec="${sec}"] .sub-sel`).forEach(s => {
        if (s.value) usage[s.value] = (usage[s.value] || 0) + 1;
    });

    let html = `<div style="width: 130px; font-size: 11px; padding: 5px;">`;
    html += `<b style="color:var(--warning)">Class ${cls} (${sec})</b><hr style="border-color:#555">`;

    Object.keys(config.subjects[cls]).forEach(sub => {
        let target = config.subjects[cls][sub];
        let current = usage[sub] || 0;
        let color = current >= target ? '#34a853' : '#fff';
        html += `<div style="display:flex; justify-content:space-between; color:${color}"> <span>${sub}:</span> <b>${current}/${target}</b></div>`;
    });
    html += `</div>`;
    const tt = document.getElementById('tooltip'); tt.innerHTML = html; tt.style.display = 'block'; 
    tt.style.left = (e.pageX + 15) + 'px'; 
    tt.style.top = (e.pageY + 10) + 'px';
}

function hideTooltip() { document.getElementById('tooltip').style.display = 'none'; }

let isHighlight = false;
function checkIncomplete() {
    if(!isHighlight){ isHighlight = true;
        document.querySelectorAll(`tr[data-day="${document.getElementById('targetDay').value}"] .routine-cell`).forEach(td => {
            if(!td.querySelector('.sub-sel').value) td.classList.add('highlight-incomplete');
        });
    }else{ document.querySelectorAll('.routine-cell').forEach(td => td.classList.remove('highlight-incomplete')); isHighlight = false;}
}

async function resetDay() {
    const day = document.getElementById('targetDay').value;
    const result = await Swal.fire({
        title: 'আপনি কি নিশ্চিত?', text: `আপনি কি রুটিন থেকে "${day}" দিনের সব তথ্য মুছে ফেলতে চান?`, icon: 'warning', showCancelButton: true, 
        confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'হ্যাঁ, মুছে ফেলুন', cancelButtonText: 'না, বাতিল করুন'
    });

    if (result.isConfirmed) {
        const rows = document.querySelectorAll(`tr[data-day="${day}"]`);
        if (rows.length === 0) { Swal.fire('Error', 'এই দিনের কোনো তথ্য পাওয়া যায়নি!', 'error'); return;}

        rows.forEach(row => {
            row.querySelectorAll('.routine-cell').forEach(td => {
                const subSel = td.querySelector('.sub-sel'); if (subSel) subSel.value = "";     // subject dropdown খালি করা
                const tSel = td.querySelector('.t-sel');
                if (tSel) { tSel.innerHTML = '<option value="">---</option>';  tSel.style.display = 'block';}

                td.querySelectorAll('.trade-selector-container').forEach(e => e.remove());     // ট্রেড সেকশন (৪টি মিনি ড্রপডাউন) থাকলে তা মুছে ফেলা
                td.classList.remove('invalid-selection');                                     // এরর বা ইনভ্যালিড সিলেকশন ক্লাস থাকলে তা রিমুভ করা
                td.classList.remove('highlight-incomplete');
            });
        });
        manualSave();                                                                      // ডাটা সেভ এবং ড্যাশবোর্ড আপডেট করা
        updateUI();
        Swal.fire( 'মুছে ফেলা হয়েছে!', `${day} এর রুটিন সফলভাবে পরিষ্কার করা হয়েছে।`, 'success');
    }
}

function fullReset() { if(confirm("আপনি কি নিশ্চিত যে সকল ডাটা মুছে ফেলবেন?")) { localStorage.clear();  location.reload();}}

window.onload = init;