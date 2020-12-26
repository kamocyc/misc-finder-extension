// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

const getProjects = () => {
  return Array.from(document.getElementById('scrapboxProjectList').children, node => {
      return [...node.children].filter(node => node.nodeName === 'INPUT')[0].value;
    });
};

const updateStorage = () => {
  const projects = getProjects();
  chrome.storage.sync.set({'projects': projects});
};

const removeParentNode = e => {
  e.target.parentNode.remove();
  updateStorage();
};

const addProjectToList = project => {
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

  document.getElementById('scrapboxProjectList').appendChild(liElm);
};

const initProjectList = () => {
  chrome.storage.sync.get(['projects'], (data) => {
    if(data.projects) {
      data.projects.map(project => {
        addProjectToList(project);   
      });
    }
  });
};

initProjectList();

document.getElementsByClassName('scrapboxProjectList-delete').onclick = removeParentNode;

document.getElementById('scrapboxProjectList-form').onsubmit = e => {
  e.preventDefault();
  const project = document.getElementById('newScrapboxProjectName').value;
  if(project != '' && getProjects().indexOf(project) === -1) {
    addProjectToList(project);
    
    updateStorage();

    document.getElementById('newScrapboxProjectName').value = '';
  }
};

