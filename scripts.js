// ใช้ corsproxy.io
const PROXY_URL = "https://corsproxy.io/?";

// ตารางแต้ม 35 Point Buy
const pointCosts = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
  16: 12,
  17: 15,
  18: 19,
};

// อัปเดต Total Points
function updateTotalPoints() {
  const stats = ["str", "dex", "con", "int", "wis", "cha"];
  let total = 0;
  stats.forEach((id) => {
    const val = parseInt(document.getElementById(id).value) || 8;
    total += pointCosts[val] || 0;
  });
  document.getElementById(
    "totalPoints"
  ).textContent = `Total Points: ${total}/35`;
}

// เพิ่มค่า Stat
function increaseStat(id) {
  const input = document.getElementById(id);
  let value = parseInt(input.value);
  if (value >= 18) return;
  input.value = value + 1;
  updateTotalPoints();
}

// ลดค่า Stat
function decreaseStat(id) {
  const input = document.getElementById(id);
  let value = parseInt(input.value);
  if (value <= 8) return;
  input.value = value - 1;
  updateTotalPoints();
}

// Reset ค่า Stat ทั้งหมดเป็น 8
function resetStats() {
  const stats = ["str", "dex", "con", "int", "wis", "cha"];
  stats.forEach((id) => {
    document.getElementById(id).value = 8;
  });
  updateTotalPoints();
}

// ฟังก์ชันเมื่อโหลดหน้าหรือเปลี่ยนค่า
window.addEventListener("DOMContentLoaded", () => {
  updateTotalPoints();

  document.getElementById("resetStats").addEventListener("click", resetStats);
});

async function fetchCharacter() {
  const urlInput = document.getElementById("characterUrl").value.trim();
  const loading = document.getElementById("loading");
  const fetchBtn = document.getElementById("fetchBtn");

  if (!urlInput) return alert("กรุณาใส่ลิงก์ตัวละคร");

  const match = urlInput.match(/\/characters\/(\d+)/);
  if (!match) return alert("URL ไม่ถูกต้อง กรุณาตรวจสอบ");

  const characterId = match[1];
  const apiUrl = `https://character-service.dndbeyond.com/character/v5/character/${characterId}`;
  const proxyUrl = `${PROXY_URL}${encodeURIComponent(apiUrl)}`;

  loading.classList.remove("hidden");
  fetchBtn.disabled = true;

  try {
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    if (!json.success || !json.data)
      throw new Error("ไม่พบข้อมูลตัวละคร หรือตัวละครไม่เป็น Public");

    const c = json.data;

    // === ฟังก์ชันช่วย ===
    const safeArray = (arr) => (Array.isArray(arr) ? arr : []);
    const safeValue = (val, def = "") => (val == null ? def : val);

    // === ดึง Stat (id 1-6) ===
    const statMap = {};
    const statNames = {
      1: "STR",
      2: "DEX",
      3: "CON",
      4: "INT",
      5: "WIS",
      6: "CHA",
    };
    safeArray(c.stats).forEach((s) => {
      const name = statNames[s.id];
      if (name) statMap[name] = s.value;
    });

    // === คลาสหลัก + เลเวล ===
    const primaryClass = safeArray(c.classes)
      .map((cl) => `${cl.definition?.name} ${cl.level}`)
      .join(", ");

    // === คลาสรอง ===
    const multiclass = c.classes
      .map((cls) => safeValue(cls?.subclassDefinition?.name, ""))
      .filter((name) => name !== "")
      .join(", ");

    // === เผ่า ===
    let asiText = "";
    const raceName = safeValue(c.race?.fullName || c.race?.baseRaceName, "-");

    // === customLineage ===
    // (Race)
    const customLineage = [];
    const excludedcustomLineage = [
      "Ability Score Increase",
      "Ability Score Increases",
      "Age",
      "Alignment",
      "Ancestral Legacy",
      "Feat",
      "Creature Type",
      "Darkvision",
      "Languages",
      "Size",
      "Skills",
      "Skill Versatility",
      "Speed",
      "Keen Senses",
      "Variable Trait",
      "Versatile",
      "Skillful",
      "Increase two scores (+2 / +1)",
    ];
    safeArray(c.race?.racialTraits).forEach((rr) => {
      if (
        rr.definition?.name &&
        !excludedcustomLineage.includes(rr.definition?.name)
      ) {
        customLineage.push(`${rr.definition?.name}`);
      }
    });
    safeArray(c.modifiers?.race).forEach((mod) => {
      if (mod.type === "size" && mod.friendlySubtypeName) {
        customLineage.push(`Size ${mod.friendlySubtypeName}`);
      }
    });
    safeArray(c.modifiers?.race).forEach((mod) => {
      if (mod.type === "set-base" && mod.friendlySubtypeName && mod.value) {
        customLineage.push(`${mod.friendlySubtypeName} ${mod.value} ft.`);
      }
    });

    // === Background ===
    const background = safeValue(
      c.background?.hasCustomBackground
        ? `${c.background.customBackground?.name || ""} (Background Feature: ${c.background.customBackground?.featuresBackground?.featureName || ""
        } [${c.background.customBackground?.featuresBackground?.name || ""}])`
        : c.background?.definition?.name,
      ""
    );

    // === Feats (ไม่รวม Hero's Journey Boon, Dark Bargain) ===
    const blockedFeats = ["hero's journey boon", "dark bargain"];
    const feats =
      safeArray(c.feats)
        .map((f) => f.definition?.name || "")
        .filter((name) => !blockedFeats.includes(name.toLowerCase()))
        .join(", ") || "";

    const languages = [];
    // จัดการภาษาจากเผ่า (Race)
    safeArray(c.modifiers?.race).forEach((mod) => {
      if (mod.type === "language" && mod.friendlySubtypeName) {
        languages.push(`${mod.friendlySubtypeName}(R)`);
      }
    });
    // จัดการภาษาจากพื้นหลัง (Background)
    safeArray(c.modifiers?.background).forEach((mod) => {
      if (mod.type === "language" && mod.friendlySubtypeName) {
        languages.push(`${mod.friendlySubtypeName}(B)`);
      }
    });
    // จัดการภาษาจากพื้นหลัง (Class)
    safeArray(c.modifiers?.class).forEach((mod) => {
      if (mod.type === "language" && mod.friendlySubtypeName) {
        languages.push(`${mod.friendlySubtypeName}(C)`);
      }
    });

    const skills = [];
    const includedSkills = [
      "Athletics",
      "Acrobatics",
      "Sleight of Hand",
      "Stealth",
      "Arcana",
      "History",
      "Investigation",
      "Nature",
      "Religion",
      "Animal Handling",
      "Insight",
      "Medicine",
      "Perception",
      "Survival",
      "Deception",
      "Intimidation",
      "Performance",
      "Persuasion",
    ];
    // จัดการสกิลจากเผ่า (Race)
    safeArray(c.modifiers?.race).forEach((mod) => {
      if (
        mod.type === "proficiency" &&
        includedSkills.includes(mod.friendlySubtypeName)
      ) {
        skills.push(`${mod.friendlySubtypeName}(R)`);
      }
    });
    // จัดการสกิลจากเผ่า (Background)
    safeArray(c.modifiers?.background).forEach((mod) => {
      if (
        mod.type === "proficiency" &&
        includedSkills.includes(mod.friendlySubtypeName)
      ) {
        skills.push(`${mod.friendlySubtypeName}(B)`);
      }
    });
    // จัดการสกิลจากเผ่า (Class)
    safeArray(c.modifiers?.class).forEach((mod) => {
      if (
        mod.type === "proficiency" &&
        includedSkills.includes(mod.friendlySubtypeName)
      ) {
        skills.push(`${mod.friendlySubtypeName}(C)`);
      }
    });

    const tools = [];
    const excludedItemsTools = [
      "Club",
      "Dagger",
      "Greatclub",
      "Handaxe",
      "Javelin",
      "Light Hammer",
      "Mace",
      "Quarterstaff",
      "Sickle",
      "Spear",
      "Light Crossbow",
      "Dart",
      "Shortbow",
      "Sling",
      "Battleaxe",
      "Flail",
      "Glaive",
      "Greataxe",
      "Greatsword",
      "Halberd",
      "Lance",
      "Longsword",
      "Maul",
      "Morningstar",
      "Pike",
      "Rapier",
      "Scimitar",
      "Shortsword",
      "Trident",
      "War Pick",
      "Warhammer",
      "Whip",
      "Blowgun",
      "Hand Crossbow",
      "Heavy Crossbow",
      "Longbow",
      "Net",
      "Simple Weapons",
      "Crossbow, Hand",
      "Crossbow, Light",
      "Strength Saving Throws",
      "Dexterity Saving Throws",
      "Constitution Saving Throws",
      "Intelligence Saving Throws",
      "Wisdom Saving Throws",
      "Charisma Saving Throws",
      "Light Armor",
      "Medium Armor",
      "Heavy Armor",
      "Shields",
      "Martial Weapons",
      "Athletics",
      "Acrobatics",
      "Sleight of Hand",
      "Stealth",
      "Arcana",
      "History",
      "Investigation",
      "Nature",
      "Religion",
      "Animal Handling",
      "Insight",
      "Medicine",
      "Perception",
      "Survival",
      "Deception",
      "Intimidation",
      "Performance",
      "Persuasion",
      "Firearms",
      "Choose a Barbarian Skill",
      "Choose a Bard Skill",
      "Choose a Cleric Skill",
      "Choose a Druid Skill",
      "Choose a Fighter Skill",
      "Choose a Monk Skill",
      "Choose a Paladin Skill",
      "Choose a Ranger Skill",
      "Choose a Rogue Skill",
      "Choose a Sorcerer Skill",
      "Choose a Warlock Skill",
    ];
    // (Race)
    safeArray(c.modifiers?.race).forEach((mod) => {
      if (
        mod.type === "proficiency" &&
        mod.friendlySubtypeName &&
        !excludedItemsTools.includes(mod.friendlySubtypeName)
      ) {
        tools.push(`${mod.friendlySubtypeName}(R)`);
      }
    });
    // (Background)
    safeArray(c.modifiers?.background).forEach((mod) => {
      if (
        mod.type === "proficiency" &&
        mod.friendlySubtypeName &&
        !excludedItemsTools.includes(mod.friendlySubtypeName)
      ) {
        tools.push(`${mod.friendlySubtypeName}(B)`);
      }
    });
    // (Class)
    safeArray(c.modifiers?.class).forEach((mod) => {
      if (
        mod.type === "proficiency" &&
        mod.friendlySubtypeName &&
        !excludedItemsTools.includes(mod.friendlySubtypeName)
      ) {
        tools.push(`${mod.friendlySubtypeName}(C)`);
      }
    });
    // (Feat)
    safeArray(c.modifiers?.feat).forEach((mod) => {
      if (
        mod.type === "proficiency" &&
        mod.friendlySubtypeName &&
        !excludedItemsTools.includes(mod.friendlySubtypeName)
      ) {
        tools.push(`${mod.friendlySubtypeName}(Feat)`);
      }
    });

    const expertise = [];
    // (Race)
    safeArray(c.modifiers?.race).forEach((mod) => {
      if (mod.type === "expertise" && mod.friendlySubtypeName) {
        expertise.push(`${mod.friendlySubtypeName}(R)`);
      }
    });
    // (Background)
    safeArray(c.modifiers?.background).forEach((mod) => {
      if (mod.type === "expertise" && mod.friendlySubtypeName) {
        expertise.push(`${mod.friendlySubtypeName}(B)`);
      }
    });
    // (Class)
    safeArray(c.modifiers?.class).forEach((mod) => {
      if (mod.type === "expertise" && mod.friendlySubtypeName) {
        expertise.push(`${mod.friendlySubtypeName}(C)`);
      }
    });

    // classOptions
    const classOptions = new Set();
    // Fighting Style
    const validfComponentIds = [191, 262, 1610582];
    const validnComponentIds = [389];
    safeArray(c.options?.class).forEach((opt) => {
      if (
        validfComponentIds.includes(opt.componentId) &&
        opt.definition?.name
      ) {
        classOptions.add(`Fighting Style: ${opt.definition?.name}(C)`);
      }
    });
    // Name
    safeArray(c.options?.class).forEach((opt) => {
      if (
        validnComponentIds.includes(opt.componentId) &&
        opt.definition?.name
      ) {
        classOptions.add(`${opt.definition?.name}(C)`);
      }
    });
    // Actions
    safeArray(c.actions?.class).forEach((ac) => {
      if (ac.name) {
        classOptions.add(`${ac.name}(C)`);
      }
    });
    safeArray(c.actions?.feat).forEach((ac) => {
      if (ac.name) {
        classOptions.add(`${ac.name}(Feat)`);
      }
    });
    // Eldritch Invocations
    safeArray(c.options?.class).forEach((opt) => {
      if (opt.componentId === 388 && opt.definition) {
        const invocationName = opt.definition.name;
        const description = opt.definition.description;
        const match = description?.match(
          /<span class="Serif-Character-Style_Italic-Serif">([^<]+)<\/span>/i
        );
        if (match && match[1]) {
          const spellName = toTitleCase(match[1]);
          const result = `Eldritch Invocations: ${invocationName}/${spellName}(C)`;
          classOptions.add(result);
        } else {
          const result = `Eldritch Invocations: ${invocationName}(C)`;
          classOptions.add(result);
        }
      }
    });
    const finalClassOptions = Array.from(classOptions);

    // === Cantrips: ดึงเฉพาะ level: 0 จาก c.classSpells → spells → definition?.level → definition?.name ===
    const cantrips = [];
    safeArray(c.classSpells).forEach((cs) => {
      safeArray(cs.spells).forEach((spell) => {
        if (spell.definition?.level === 0) {
          cantrips.push(spell.definition?.name || "N/A");
        }
      });
    });

    safeArray(c.spells?.race).forEach((s) => {
      if (s.definition?.level === 0 && s.definition?.name) {
        cantrips.push(`${s.definition.name}(R)`);
      }
    });
    safeArray(c.spells?.class).forEach((s) => {
      if (s.definition?.level === 0 && s.definition?.name) {
        cantrips.push(`${s.definition.name}(C)`);
      }
    });
    safeArray(c.spells?.background).forEach((s) => {
      if (s.definition?.level === 0 && s.definition?.name) {
        cantrips.push(`${s.definition.name}(B)`);
      }
    });
    safeArray(c.spells?.feat).forEach((s) => {
      if (s.definition?.level === 0 && s.definition?.name) {
        cantrips.push(`${s.definition.name}(Feat)`);
      }
    });

    // === Spells ระดับ 1 ===
    const spells1 = [];
    safeArray(c.classSpells).forEach((cs) => {
      safeArray(cs.spells).forEach((spell) => {
        if (spell.definition?.level === 1) {
          spells1.push(spell.definition?.name || "N/A");
        }
      });
    });

    safeArray(c.spells?.race).forEach((s) => {
      if (s.definition?.level === 1 && s.definition?.name) {
        spells1.push(`${s.definition.name}(R)`);
      }
    });
    safeArray(c.spells?.class).forEach((s) => {
      if (s.definition?.level === 1 && s.definition?.name) {
        spells1.push(`${s.definition.name}(C)`);
      }
    });
    safeArray(c.spells?.background).forEach((s) => {
      if (s.definition?.level === 1 && s.definition?.name) {
        spells1.push(`${s.definition.name}(B)`);
      }
    });
    safeArray(c.spells?.feat).forEach((s) => {
      if (s.definition?.level === 1 && s.definition?.name) {
        spells1.push(`${s.definition.name}(Feat)`);
      }
    });

    // === Spells ระดับ 2 ===
    const spells2 = [];
    safeArray(c.classSpells).forEach((cs) => {
      safeArray(cs.spells).forEach((spell) => {
        if (spell.definition?.level === 2) {
          spells2.push(spell.definition?.name || "N/A");
        }
      });
    });

    safeArray(c.spells?.race).forEach((s) => {
      if (s.definition?.level === 2 && s.definition?.name) {
        spells2.push(`${s.definition.name}(R)`);
      }
    });
    safeArray(c.spells?.class).forEach((s) => {
      if (s.definition?.level === 2 && s.definition?.name) {
        spells2.push(`${s.definition.name}(C)`);
      }
    });
    safeArray(c.spells?.background).forEach((s) => {
      if (s.definition?.level === 2 && s.definition?.name) {
        spells2.push(`${s.definition.name}(B)`);
      }
    });
    safeArray(c.spells?.feat).forEach((s) => {
      if (s.definition?.level === 2 && s.definition?.name) {
        spells2.push(`${s.definition.name}(Feat)`);
      }
    });

    // === อัปเดตฟอร์ม ===
    document.getElementById("name").value = safeValue(c.name);
    document.getElementById("primaryClass").value = primaryClass;
    document.getElementById("multiclass").value = multiclass;
    document.getElementById("raceAsi").value = raceName;
    document.getElementById("customLineage").value = customLineage.join("\n");
    const alignmentMap = {
      1: "Lawful Good", 2: "Neutral Good", 3: "Chaotic Good",
      4: "Lawful Neutral", 5: "Neutral", 6: "Chaotic Neutral",
      7: "Lawful Evil", 8: "Neutral Evil", 9: "Chaotic Evil"
    };
    document.getElementById("alignment").value = alignmentMap[c.alignmentId] || "-";
    document.getElementById("background").value = background;
    document.getElementById("feat").value = feats;
    document.getElementById("classOptions").value = finalClassOptions.join("\n");
    document.getElementById("cantrips").value = cantrips.join("\n");
    document.getElementById("spells1").value = spells1.join("\n");
    document.getElementById("spells2").value = spells2.join("\n");
    document.getElementById("languages").value = languages.join(", ");
    document.getElementById("skills").value = skills.join(", ");
    document.getElementById("tools").value = tools.join(", ");
    document.getElementById("expertise").value = expertise.join(", ");

    // === Stat ===
    Object.entries(statMap).forEach(([key, val]) => {
      const el = document.getElementById(key.toLowerCase());
      if (el) el.value = val;
    });

    // อัปเดตลิงก์อัตโนมัติ
    document.getElementById("sheetLink").value = c.readonlyUrl;

    // อัปเดต Total Points หลังดึงข้อมูล
    updateTotalPoints();
    document.getElementById("successModal").classList.remove("hidden");
    document.getElementById("successModalOverlay").classList.remove("hidden");
  } catch (err) {
    console.error("Fetch Error:", err);
    alert("ดึงข้อมูลไม่สำเร็จ: " + (err.message || "เกิดข้อผิดพลาด"));
  } finally {
    loading.classList.add("hidden");
    fetchBtn.disabled = false;
  }
}

// === Logic สำหรับ Generate และ Copy ===
function val(id) {
  return (document.getElementById(id)?.value || "").trim();
}
function num(id) {
  const v = document.getElementById(id)?.value;
  return v === "" ? "0" : String(Number(v));
}
function radio(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : "";
}

function composeDiscordText() {
  const lines = [
    `ชื่อ: ${val("name") || "-"}`,
    "",
    `คลาสหลัก: ${val("primaryClass") || "-"}`,
    "",
    `คลาสรอง: ${val("multiclass") || "-"}`,
    "",
    `เผ่าและ ASI Bonus จากเผ่า: ${val("raceAsi") || "-"}`,
    "",
    `Custom Lineage Trait:\n${val("customLineage") || "-"}`,
    "",
    `Alignment: ${val("alignment")}`,
    `Background: ${val("background") || "-"}`,
    "",
    `Stat หลัก: (ไม่รวม Bonus) ${num("str")} Str / ${num("dex")} Dex / ${num(
      "con"
    )} Con / ${num("int")} Int / ${num("wis")} Wis / ${num("cha")} Cha`,
    "",
    `ภาษา: ${val("languages") || "-"}`,
    "",
    `Proficient Skills: ${val("skills") || "-"}`,
    "",
    `Proficient Tools: ${val("tools") || "-"}`,
    "",
    `Expertise: ${val("expertise") || "-"}`,
    "",
    `Feat: ${val("feat") || "-"}`,
    "",
    `ตัวเลือกอื่นๆจากคลาส:\n${val("classOptions") || "-"}`,
    "",
    `Cantrips:\n${val("cantrips") || "-"}`,
    "",
    `Spells ระดับ 1:\n${val("spells1") || "-"}`,
    "",
    `Spells ระดับ 2:\n${val("spells2") || "-"}`,
    "",
    `Tracking Sheet Link: ${val("trackLink") || "-"}`,
    `Character Sheet Link (${radio("platform")}): ${val("sheetLink") || "-"}`,
  ];
  return lines.join("\n");
}

document.getElementById("btnGenerate").addEventListener("click", () => {
  document.getElementById("output").value = composeDiscordText();
});

document.getElementById("btnCopy").addEventListener("click", async () => {
  const out = document.getElementById("output");
  if (!out.value.trim()) out.value = composeDiscordText();
  try {
    await navigator.clipboard.writeText(out.value);
    const t = document.getElementById("toast");
    t.classList.remove("hidden");
    setTimeout(() => t.classList.add("hidden"), 1600);
  } catch (e) {
    alert("คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง");
  }
});

// Persist
const persistIds = [
  "name",
  "primaryClass",
  "multiclass",
  "raceAsi",
  "customLineage",
  "background",
  "languages",
  "skills",
  "tools",
  "expertise",
  "feat",
  "classOptions",
  "cantrips",
  "spells1",
  "spells2",
  "trackLink",
  "sheetLink",
];
window.addEventListener("DOMContentLoaded", () => {
  persistIds.forEach((id) => {
    const saved = localStorage.getItem("dcc_" + id);
    if (saved) document.getElementById(id).value = saved;
  });
  const p = localStorage.getItem("dcc_platform");
  if (p)
    document
      .querySelector(`input[name="platform"][value="${p}"]`)
      ?.setAttribute("checked", "");
});
document.addEventListener("input", (e) => {
  if (persistIds.includes(e.target.id))
    localStorage.setItem("dcc_" + e.target.id, e.target.value);
  if (e.target.name === "platform")
    localStorage.setItem("dcc_platform", e.target.value);
});

function toTitleCase(str) {
  return str
    .split(" ")
    .map((word) => {
      if (word.length === 0) return "";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
