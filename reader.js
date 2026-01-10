const dict = window.CEDICT;

const input = document.getElementById("input");
const hanziDiv = document.getElementById("hanzi");
const engDiv = document.getElementById("english");
const tooltip = document.getElementById("tooltip");
const reader = document.getElementById("reader");

const settingsButton = document.getElementById("settings-button");
const settingsMenu = document.getElementById("settings-menu");
const darkModeToggle = document.getElementById("darkmode-toggle");
const textSizeSelect = document.getElementById("textsize-select");
const fontSelect = document.getElementById("font-select");

const urlInput = document.getElementById("url-input");
const importButton = document.getElementById("import-button");

hanziDiv.style.whiteSpace = "pre-wrap";

// ------------------
// Render button
// ------------------
document.getElementById("render").onclick = async () => {
  const text = input.value;
  render(text);
  const translations = await translateText(text);
  renderTranslation(translations);
};

document.getElementById("fullscreen").onclick = () => reader.classList.toggle("fullscreen");

// ------------------
// Convert numbered pinyin to diacritics
// ------------------
function convertPinyin(pinyin){
  const toneMap = {
    a:["ā","á","ǎ","à"],
    e:["ē","é","ě","è"],
    i:["ī","í","ǐ","ì"],
    o:["ō","ó","ǒ","ò"],
    u:["ū","ú","ǔ","ù"],
    ü:["ǖ","ǘ","ǚ","ǜ"]
  };
  return pinyin
    .split(' ')
    .map(syl => {
      const m = syl.match(/^([a-zü]+)([1-5])$/i);
      if(!m) return syl;
      let [_, core, tone] = m;
      tone = parseInt(tone);
      if(tone === 5) return core; // neutral tone: remove number
      tone -= 1;
      for(const vow of ["a","e","o","i","u","ü"]){
        if(core.includes(vow)){
          return core.replace(vow, toneMap[vow][tone]);
        }
      }
      return core;
    }).join(' ');
}

// ------------------
// Segment text for hover only
// ------------------
function segment(text){
  const segs = [];
  let i = 0;
  while(i < text.length){
    let found = null;
    for(let l=Math.min(6,text.length-i); l>0; l--){
      const s = text.slice(i, i+l);
      if(dict[s]) { found = s; break; }
    }
    if(found){
      segs.push({text: found, entry: dict[found][0]});
      i += found.length;
    } else {
      segs.push({text: text[i], entry: null});
      i++;
    }
  }
  return segs;
}

// ------------------
// Render text preserving everything exactly
// ------------------
function render(text){
  hanziDiv.innerHTML = "";

  const lines = text.split(/\r?\n/);

  lines.forEach(line => {
    const segs = segment(line);

    segs.forEach(segObj => {
      const span = document.createElement("span");
      span.textContent = segObj.text;

      if(segObj.entry){
        span.onmouseenter = e => {
          const defs = segObj.entry.english
            .split("/")
            .filter(d => d.trim() !== "")
            .map((d,i) => {
              // detect "中文 pinyin" pattern
              const match = d.match(/^([\u4e00-\u9fff]+)\s*\[([a-zü0-9\s]+)\]$/i);
              if(match){
                return `${i+1}. ${match[1]} [${convertPinyin(match[2])}]`;
              } else {
                return `${i+1}. ${d}`;
              }
            });
          tooltip.innerHTML = `<b>${convertPinyin(segObj.entry.pinyin)}</b><br>${defs.join("<br>")}`;
          tooltip.style.display = "block";
        };
        span.onmousemove = e => {
          tooltip.style.left = e.pageX + 12 + "px";
          tooltip.style.top = e.pageY + 12 + "px";
        };
        span.onmouseleave = () => tooltip.style.display="none";
      }

      hanziDiv.appendChild(span);
    });

    hanziDiv.appendChild(document.createElement("br"));
  });
}

// ------------------
// Render translations nicely
// ------------------
function renderTranslation(translations){
  engDiv.innerHTML = "<b>Translation:</b><br>";
  translations.forEach(t => {
    const p = document.createElement("p");
    p.textContent = t;
    engDiv.appendChild(p);
  });
}

// ------------------
// Translate full text via API
// ------------------
async function translateText(text){
  const sentences = text.split(/(?<=[。！？])/);
  const translations = [];
  for(const sentence of sentences){
    if(sentence.trim().length === 0) continue;
    try {
      const resp = await fetch("https://libretranslate.de/translate", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ q: sentence, source:"zh", target:"en", format:"text" })
      });
      const data = await resp.json();
      translations.push(data.translatedText);
    } catch(e){
      console.error("Translation failed", e);
      translations.push(""); 
    }
  }
  return translations;
}

// ------------------
// Settings menu
// ------------------
settingsButton.onclick = () => settingsMenu.classList.toggle("open");

darkModeToggle.onchange = () => {
  if(darkModeToggle.checked){
    document.body.classList.add("darkmode");
  } else {
    document.body.classList.remove("darkmode");
  }
};

textSizeSelect.onchange = () => {
  hanziDiv.style.fontSize = textSizeSelect.value + "px";
  engDiv.style.fontSize = textSizeSelect.value + "px";
};

fontSelect.onchange = () => {
  hanziDiv.style.fontFamily = fontSelect.value;
  engDiv.style.fontFamily = fontSelect.value;
};

// ------------------
// Import text from website
// ------------------
importButton.onclick = async () => {
  const url = urlInput.value.trim();
  if(!url) return;

  engDiv.innerHTML = "Fetching text…";

  try {
    const resp = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
    const data = await resp.json();
    const html = data.contents;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const paragraphs = Array.from(doc.querySelectorAll("p"))
      .map(p => p.innerText.trim())
      .filter(t => t.length > 0);

    const text = paragraphs.join("\n\n");

    input.value = text;
    render(text);
    const translations = await translateText(text);
    renderTranslation(translations);
  } catch(e){
    console.error("Failed to fetch text", e);
    engDiv.innerHTML = "Failed to fetch text from the website.";
  }
};