// routine.js

function runAutoFill(day) {
    let classes = [...config.classes].sort(() => Math.random() - 0.5);
    let sections = [...config.sections].sort(() => Math.random() - 0.5);

    classes.forEach(cls => {
        sections.forEach(sec => {
            let subjectsNeeded = [];
            Object.keys(config.subjects[cls]).forEach(sub => {
                let currentCount = 0;
                document.querySelectorAll(`tr[data-cls="${cls}"][data-sec="${sec}"] .sub-sel`).forEach(s => {
                    if (s.value === sub) currentCount++;
                });
                
                let remaining = config.subjects[cls][sub] - currentCount;
                
                for (let i = 0; i < remaining; i++) {
                    let bSize = 1;
                    if (sub === "ICT" || sub === "Drawing") bSize = 2;
                    else if (sub === "Work" || sub.includes("Trade")) {
                        bSize = (remaining >= 3 && i <= (remaining - 3)) ? 3 : 1; 
                    }
                    subjectsNeeded.push({ name: sub, size: bSize });
                    if (bSize > 1) i += (bSize - 1);
                }
            });

            for (let p = 1; p <= (cls <= 8 ? 6 : 8); p++) {
                const td = document.getElementById(`${day}-${cls}-${sec}-p${p}`);
                if (!td || td.querySelector('.sub-sel').value !== "") continue;

                subjectsNeeded.sort(() => Math.random() - 0.5);

                let placed = false;
                for (let j = 0; j < subjectsNeeded.length; j++) {
                    let item = subjectsNeeded[j];
                    let res = checkAdvancedRule(cls, sec, p, item.name, item.size, day);

                    if (res.possible) {
                        for (let k = 0; k < item.size; k++) {
                            let target = document.getElementById(`${day}-${cls}-${sec}-p${p + k}`);
                            if(target) {
                                target.querySelector('.sub-sel').value = item.name;
                                let tSel = target.querySelector('.t-sel');
                                
                                // যদি ট্রেড হয় তবে অটোমেটিক ৪টি ড্রপডাউন সেটআপ করবে
                                if (item.name === "Trade1" || item.name === "Trade2") {
                                    if(tSel) tSel.style.display = 'none';
                                    setupTradeCell(target, item.name);
                                } else {
                                    if(tSel) {
                                        tSel.style.display = 'block';
                                        tSel.innerHTML = getTOpts(item.name, res.teacher);
                                        tSel.value = res.teacher;
                                    }
                                }
                            }
                        }
                        subjectsNeeded.splice(j, 1);
                        p += (item.size - 1);
                        placed = true;
                        break;
                    }
                }
            }
        });
    });
    manualSave(); // সব শেষে ডাটা সেভ
}

function checkAdvancedRule(cls, sec, p, sub, block, day) {
    const potentialTeachers = Object.keys(teachers).filter(t => teachers[t].subs.includes(sub));
    
    // ট্রেডের জন্য টিচার চেক আলাদা
    if (sub === "Trade1" || sub === "Trade2") {
        const trades = ['A', 'C', 'E', 'W'];
        for (let tr of trades) {
            let hasTeacher = Object.values(teachers).some(t => t.subs.includes(sub) && t.trade === tr);
            if (!hasTeacher) return { possible: false };
        }
    } else {
        if (potentialTeachers.length === 0) return { possible: false };
    }

    // ১. দৈনিক লোড ও ব্লকিং চেক
    const row = document.querySelector(`tr[data-day="${day}"][data-cls="${cls}"][data-sec="${sec}"]`);
    let dayTotal = 0;
    row.querySelectorAll('.sub-sel').forEach(sel => { if (sel.value === sub) dayTotal++; });
    
    if (sub === "Work" || sub.includes("Trade")) {
        if (dayTotal > 0) return { possible: false }; // একই দিন দুইবার ট্রেড/ওয়ার্ক না রাখা ভালো
    } else if (sub === "ICT" || sub === "Drawing") {
        if (dayTotal >= 2) return { possible: false };
    } else {
        if (dayTotal > 0) return { possible: false };
    }

    // ২. বাউন্ডারি ও টিফিন চেক
    let startP = parseInt(p);
    let endP = startP + block - 1;
    let maxP = (cls <= 8) ? 6 : 8;

    if (endP > maxP) return { possible: false };
    if (block > 1 && startP <= 4 && endP > 4) return { possible: false };

    // ৩. পরবর্তী ঘর খালি আছে কিনা
    for (let i = 1; i < block; i++) {
        const nextTd = document.getElementById(`${day}-${cls}-${sec}-p${startP + i}`);
        if (!nextTd || nextTd.querySelector('.sub-sel').value !== "") return { possible: false };
    }

    // ৪. ICT Lab Conflict
    if (sub === "ICT") {
        for (let i = 0; i < block; i++) {
            let cp = startP + i;
            let labInUse = Array.from(document.querySelectorAll(`tr[data-day="${day}"] .sub-sel`)).some(sel => {
                let td = sel.closest('td');
                return !td.id.includes(`-${cls}-${sec}-`) && td.id.includes(`-p${cp}`) && sel.value === "ICT";
            });
            if (labInUse) return { possible: false };
        }
    }

    // ৫. টিচার বিজি চেক (সাধারণ সাবজেক্টের জন্য)
    if (sub !== "Trade1" && sub !== "Trade2") {
        for (let tCode of potentialTeachers) {
            let isBusy = false;
            for (let i = 0; i < block; i++) {
                let cp = startP + i;
                document.querySelectorAll(`.t-day-${day}.t-p-${cp}`).forEach(sel => {
                    if (sel.value === tCode) isBusy = true;
                });
            }
            if (!isBusy) return { possible: true, teacher: tCode };
        }
        return { possible: false };
    }

    return { possible: true };
}

// ট্রেড সেলের ৪টি ড্রপডাউন সেটআপ
function setupTradeCell(td, sub) {
    // আগের থাকলে রিমুভ
    td.querySelectorAll('.trade-selector-container').forEach(e => e.remove());
    
    const trades = ['A', 'C', 'E', 'W'];
    let container = document.createElement('div');
    container.className = 'trade-selector-container';
    container.style.cssText = "display:grid; grid-template-columns: 1fr 1fr; gap:2px; margin-top:3px; background:#f0f0f0; padding:2px; border-radius:4px;";

    trades.forEach(trCode => {
        let sel = document.createElement('select');
        sel.className = 'trade-mini-sel';
        sel.dataset.trade = trCode;
        sel.style.fontSize = '10px';
        
        let options = `<option value="">${trCode}</option>`;
        Object.keys(teachers).forEach(tCode => {
            if (teachers[tCode].subs.includes(sub) && teachers[tCode].trade === trCode) {
                options += `<option value="${tCode}">${tCode}</option>`;
            }
        });
        sel.innerHTML = options;
        // যদি ওই ট্রেডের জন্য একজনই টিচার থাকে, তাকে অটো সিলেক্ট করবে
        if (sel.options.length === 2) sel.selectedIndex = 1;
        
        sel.onchange = manualSave;
        container.appendChild(sel);
    });
    td.appendChild(container);
}

// Tooltip লজিক আগের মতোই ঠিক আছে
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
        html += `<div style="display:flex; justify-content:space-between; color:${color}">
                    <span>${sub}:</span> 
                    <b>${current}/${target}</b>
                 </div>`;
    });
    html += `</div>`;
    
    const tt = document.getElementById('tooltip');
    tt.innerHTML = html;
    tt.style.display = 'block';
    tt.style.left = (e.pageX + 15) + 'px';
    tt.style.top = (e.pageY + 10) + 'px';
}

function hideTooltip() { document.getElementById('tooltip').style.display = 'none'; }






function subChg(el) {
    const td = el.closest('td');
    const tr = el.closest('tr');
    const day = tr.dataset.day;
    const cls = tr.dataset.cls;
    const sec = tr.dataset.sec;
    const sub = el.value;
    const ts = td.querySelector('.t-sel');
    const pParts = td.id.split('-p'); 
    const p = parseInt(pParts[1]);
    
    td.classList.remove('invalid-selection');
    // আগের ট্রেড সিলেক্টর বা প্র্যাকটিক্যাল মার্কার থাকলে মুছে ফেলা
    td.querySelectorAll('.trade-selector-container').forEach(e => e.remove());

    if (sub !== "") {
        let bSize = 1; 
        if (sub === "ICT" || sub === "Drawing") { 
            bSize = 2; 
        } 
        else if (sub === "Work" || sub.includes("Trade")) {
            const isPractical = confirm(sub + " : আপনি কি এই বিষয়ের ব্যবহারিক (Practical) ক্লাস বসাতে চান? \n\n[OK = ৩ পিরিয়ড, Cancel = ১ পিরিয়ড]");
            bSize = isPractical ? 3 : 1;
        }

        // পিরিয়ড সীমা এবং টিফিন ব্রেক চেক
        let res = checkManualAdvancedRule(cls, sec, p, sub, bSize, day); 
        
        if (!res.possible) {
            td.classList.add('invalid-selection');
            showToast("⚠️ " + res.msg);
            el.value = ""; 
            ts.innerHTML = '<option value="">---</option>';
            return;
        }

        // --- মেইন লজিক: পরের ঘরগুলো অটো-ফিল করা ---
        if (sub === "Trade1" || sub === "Trade2") {
            // ট্রেড হলে প্রতি পিরিয়ডে ৪টি করে ড্রপডাউন বসবে
            for (let i = 0; i < bSize; i++) {
                let targetTd = document.getElementById(`${day}-${cls}-${sec}-p${p + i}`);
                if (targetTd) {
                    targetTd.querySelector('.sub-sel').value = sub;
                    let targetTs = targetTd.querySelector('.t-sel');
                    targetTs.style.display = 'none'; // মেইন টিচার ড্রপডাউন হাইড
                    setupTradeCell(targetTd, sub); // ৪টি ট্রেড টিচার বক্স তৈরি
                }
            }
        } else {
            // সাধারণ বিষয়ের জন্য (ICT, Drawing, Work)
            for (let i = 0; i < bSize; i++) {
                let targetTd = document.getElementById(`${day}-${cls}-${sec}-p${p + i}`);
                if (targetTd) {
                    targetTd.querySelector('.sub-sel').value = sub;
                    let targetTs = targetTd.querySelector('.t-sel');
                    targetTs.style.display = 'block';
                    targetTs.innerHTML = getTOpts(sub, res.teacher);
                    targetTs.value = res.teacher;
                }
            }
        }
    } else { 
        // যদি সাবজেক্ট মুছে ফেলা হয় (Empty সিলেক্ট করলে)
        ts.style.display = 'block';
        ts.innerHTML = '<option value="">---</option>';
    } 
    manualSave(); 
}


function checkManualAdvancedRule(cls, sec, p, sub, block, day) {
    // এই বিষয়ের টিচার লিস্ট চেক করা
    const teacherList = Object.keys(teachers).filter(t => teachers[t].subs.includes(sub));
    
    // ট্রেড হলে ৪ জন টিচার আছে কিনা চেক করা (অন্যান্য বিষয়ের জন্য আগের লজিক)
    if (sub === "Trade1" || sub === "Trade2") {
        const trades = ['A', 'C', 'E', 'W'];
        for (let tr of trades) {
            let hasTeacher = Object.values(teachers).some(t => t.subs.includes(sub) && t.trade === tr);
            if (!hasTeacher) return { possible: false, msg: `${sub} এর ট্রেড ${tr} এর জন্য কোনো শিক্ষক নেই!` };
        }
    } else {
        if (teacherList.length === 0) return { possible: false, msg: "এই বিষয়ের কোনো শিক্ষক এখনো Add করা হয় নি!" };
    }

    // শর্ত ১: দৈনিক লোড চেক
    const row = document.querySelector(`tr[data-day="${day}"][data-cls="${cls}"][data-sec="${sec}"]`);
    let dayTotal = 0;
    row.querySelectorAll('.sub-sel').forEach(sel => { if (sel.value === sub) dayTotal++; });
    if (dayTotal > 1) {return { possible: false, msg: sub + " আজ অলরেডি একবার বসানো হয়েছে।" };}

    // শর্ত ২: সাপ্তাহিক লোড চেক
    let countInThisSec = 0;
    document.querySelectorAll(`tr[data-cls="${cls}"][data-sec="${sec}"] .sub-sel`).forEach(sel => { if (sel.value === sub) countInThisSec++; });
    if ((countInThisSec + block - 1) > config.subjects[cls][sub]) {return { possible: false, msg: "সাপ্তাহিক ক্লাসের লিমিট শেষ!" };}

    // শর্ত ৩: পিরিয়ড সীমা ও টিফিন ব্রেক চেক
    let startP = parseInt(p);
    let endP = startP + block - 1;
    let maxP = (cls <= 8) ? 6 : 8;
    if (endP > maxP) return { possible: false, msg: "ব্যবহারিক ক্লাস শেষ হওয়ার আগেই ছুটি হয়ে যাবে।" };
    if (block > 1 && startP <= 4 && endP > 4) {
        return { possible: false, msg: "ব্যবহারিক ক্লাসের মাঝে টিফিন ব্রেক রাখা যাবে না!" };
    }

    // শর্ত ৪: ব্লক পিরিয়ডগুলো ফাঁকা আছে কি না চেক করা
    for (let i = 1; i < block; i++) {
        let cp = startP + i;
        let nextTd = document.getElementById(`${day}-${cls}-${sec}-p${cp}`);
        if (nextTd && nextTd.querySelector('.sub-sel').value !== "") {
            return { possible: false, msg: "পরবর্তী পিরিয়ডগুলো খালি নেই!" };
        }
    }

    // শর্ত ৫: ICT Lab Conflict
    if (sub === "ICT") {
        for (let i = 0; i < block; i++) {
            let cp = startP + i;
            let labInUse = false;
            document.querySelectorAll(`tr[data-day="${day}"] .sub-sel`).forEach(sel => {
                let td = sel.closest('td');
                if (!td.id.includes(`-${cls}-${sec}-`) && td.id.includes(`-p${cp}`) && sel.value === "ICT") {
                    labInUse = true;
                }
            });
            if (labInUse) return { possible: false, msg:"ICT Lab busy" };
        }
    }

    // শর্ত ৬: টিচার এভেইল্যাবিলিটি চেক (ট্রেড এর জন্য এই চেকটি ড্রপডাউনে ম্যানুয়ালি করা হবে)
    if (sub !== "Trade1" && sub !== "Trade2") {
        for (let tCode of teacherList) {
            let isTeacherBusy = false;
            for (let i = 0; i < block; i++) {
                let cp = startP + i;
                document.querySelectorAll(`.t-day-${day}.t-p-${cp}`).forEach(sel => {
                    if (sel.value === tCode) isTeacherBusy = true;
                });
                if (i > 0) {
                    const nextTd = document.getElementById(`${day}-${cls}-${sec}-p${cp}`);
                    if (nextTd && nextTd.querySelector('.sub-sel').value !== "") isTeacherBusy = true;
                }
            }
            if (!isTeacherBusy) return { possible: true, teacher: tCode };
        }
        return { possible: false, msg: "এই পিরিয়ডে শিক্ষক ব্যস্ত আছেন।" };
    }

    return { possible: true }; 
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

