import { browser } from 'webextension-polyfill-ts';

const getProjects = () => {
  //TODO: 
  const projects = document.getElementById('scrapboxProjectList');
  if(projects !== null) {
    return Array.from(projects.children, node => {
        return ([...node.children].filter(node => node.nodeName === 'INPUT')[0] as HTMLInputElement).value;
      });
  }
  throw new Error("getProject");
};

const updateStorage = async () => {
  const projects = getProjects();
  await browser.storage.sync.set({'projects': projects});
};

const removeParentNode = async (e: MouseEvent) => {
  (e.target as HTMLElement).parentElement?.remove();
  await updateStorage();
};

const addProjectToList = (project: string) => {
  const pElm = document.createElement('p');
  pElm.innerText = project;

  let buttonElm = document.createElement('button');
  buttonElm.className = 'scrapboxProjectList-delete';
  buttonElm.onclick = removeParentNode;
  buttonElm.innerText = "Delete"

  const hiddenElm = document.createElement('input');
  hiddenElm.type = 'hidden';
  hiddenElm.value = project;

  const liElm = document.createElement('li');
  liElm.appendChild(pElm);
  liElm.appendChild(buttonElm);
  liElm.appendChild(hiddenElm);

  document.getElementById('scrapboxProjectList')?.appendChild(liElm);
};

const initProjectList = async () => {
  const data = await browser.storage.sync.get(['projects']);
  
  if(data.projects) {
    data.projects.map((project: string) => {
      addProjectToList(project);   
    });
  }
};

initProjectList();

[...document.getElementsByClassName('scrapboxProjectList-delete')].forEach(e => { (e as HTMLInputElement).onclick = removeParentNode; })

document.getElementById('scrapboxProjectList-form')!.onsubmit = e => {
  e.preventDefault();
  const project = (document.getElementById('newScrapboxProjectName') as HTMLInputElement).value;
  if(project != '' && getProjects().indexOf(project) === -1) {
    addProjectToList(project);
    
    updateStorage();

    (document.getElementById('newScrapboxProjectName') as HTMLInputElement).value = '';
  }
};

