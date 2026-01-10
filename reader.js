const dict = window.CEDICT;

const input = document.getElementById("input");
const hanziDiv = document.getElementById("hanzi");
const engDiv = document.getElementById("english");
const tooltip = document.getElementById("tooltip");
const reader = document.getElementById("reader");

hanziDiv.style.whiteSpace = "pre-wrap"; // preserve all original line breaks and spacing

document.getElementById("render").onclick = async () => {
  const text = input.value;
  render(text); // preserve text exactly
  const translations = await translateText(text);
  engDiv.innerHTML = "<b>Translation:</b><br>" + translations.join("<br>");
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
      const m = syl.match(/^([a-zü]+)([1-4])$/i);
      if(!m) return syl;
      let [_, core, tone] = m;
      tone = parseInt(tone)-1;
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
  // returns array of {text, entry} for hover
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

  const lines = text.split(/\r?\n/); // preserve line breaks

  lines.forEach(line => {
    const segs = segment(line);

    segs.forEach(segObj => {
      const span = document.createElement("span");
      span.textContent = segObj.text;

      if(segObj.entry){
        span.onmouseenter = e => {
          tooltip.innerHTML = `<b>${convertPinyin(segObj.entry.pinyin)}</b><br>${segObj.entry.english}`;
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

    hanziDiv.appendChild(document.createElement("br")); // preserve even empty lines
  });
}

// ------------------
// Translate full text via API
// ------------------
async function translateText(text){
  const sentences = text.split(/(?<=[。！？])/); // keep punctuation attached
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