const TOTAL = 100;
const grid = document.getElementById("grid");
const detail = document.getElementById("detail");
const search = document.getElementById("search");

let startX = 0;
let currentIndex = 0;

function getVariants(id){
  return [
    {type:"A", img:`https://picsum.photos/200/300?random=${id}1`},
    {type:"B", img:`https://picsum.photos/200/300?random=${id}2`}
  ];
}

function render(filter=""){
  grid.innerHTML="";
  for(let i=1;i<=TOTAL;i++){
    if(filter && !i.toString().includes(filter)) continue;
    const div=document.createElement("div");
    div.className="card";
    div.innerHTML=`<img src="https://picsum.photos/200/300?random=${i}"><div>${i}</div>`;
    div.onclick=()=>openDetail(i);
    grid.appendChild(div);
  }
}

function openDetail(id){
  const variants=getVariants(id);
  currentIndex=0;

  detail.classList.remove("hidden");
  detail.innerHTML=`
    <div class="viewer">
      <img id="viewerImg" src="${variants[0].img}">
      <p id="variantText">${variants[0].type}</p>
    </div>
    <button onclick="closeDetail()">Luk</button>
  `;

  const viewer=detail.querySelector(".viewer");

  viewer.addEventListener("touchstart", e=>{
    startX=e.touches[0].clientX;
  });

  viewer.addEventListener("touchend", e=>{
    let endX=e.changedTouches[0].clientX;
    if(startX-endX>50){ currentIndex++; }
    if(endX-startX>50){ currentIndex--; }

    if(currentIndex<0) currentIndex=variants.length-1;
    if(currentIndex>=variants.length) currentIndex=0;

    document.getElementById("viewerImg").src=variants[currentIndex].img;
    document.getElementById("variantText").innerText=variants[currentIndex].type;
  });
}

function closeDetail(){
  detail.classList.add("hidden");
}

search.oninput=()=>render(search.value);
render();
