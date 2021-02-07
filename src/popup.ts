import { browser } from 'webextension-polyfill-ts';

type ResultCategory = 'scrapbox' | 'hatebu' | 'zenn' | 'history' | 'bookmark'
type SearchResult = {
  url?: string,
  description: string,
  type: ResultCategory
}

const extractHostname = (url: string) => {
  try {
    return (new URL(url)).hostname;
  } catch (e) { return ''; }
};

const ambiguouslyIncludes = (whole: string, key: string) => whole.toLocaleLowerCase().includes(key.toLocaleLowerCase());

// return true if not domains that are searched by other methods
// const isNotSpecificDomains = (url: string): boolean => {
//   const ngDomains = ['https://scrapbox.io/', 'https://b.hatena.ne.jp/', 'https://zenn.dev/'];
//   return ngDomains.every(domain => 
//     url.substr(0, domain.length) !== domain
//   );
// };

// https://scrapbox.io/scrapboxlab/API
const scrapboxFinder = async (project_name: string, query: string): Promise<SearchResult[]> => {  
  const url = `https://scrapbox.io/api/pages/${project_name}/search/query?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  const data = await res.json();
  
  return !data.pages ? [] : data.pages.map((row: any) => {
    return {
      url: `https://scrapbox.io/${project_name}/${encodeURIComponent(row.title)}`,
      description: row.title + '\n\n' + row.lines.join('\n'),
      type: 'scrapbox'
    }
  });
};

// http://developer.hatena.ne.jp/ja/documents/bookmark/apis/fulltext_search
const hatenaBookmarkFinder = async (query: string): Promise<SearchResult[]> => {
  const url = `https://b.hatena.ne.jp/my/search/json?q=${encodeURIComponent(query)}&limit=100`;
  const res = await fetch(url);
  const data = await res.json();
  
  return !data.bookmarks ? [] : data.bookmarks.map((bookmark: any) => {
    return {
      url: bookmark.entry.url,
      description: bookmark.entry.title + '\n' + extractHostname(bookmark.entry.url),
      type: 'hatebu'
    };
  });
};

// Basically, this api is not for third-party uses. So, breaking changes may occur.
const zennFinder = async (query: string): Promise<SearchResult[]> => {
  const url = `https://api.zenn.dev/me/library/likes`;
  const res = await fetch(url);
  const data = await res.json();
  
  return !data.items ? [] : data.items
    .filter((item: any) =>
      ambiguouslyIncludes(item.title, query) ||
      ambiguouslyIncludes(item.slug, query))
    .map((item: any) => {
      return {
        url: "https://zenn.dev" + item.shortlink_path,
        description: item.title,
        type: 'zenn'
      };
    });
};

// https://developer.chrome.com/docs/extensions/reference/history/#method-search
const historyFinder = async (query: string): Promise<SearchResult[]> => {
  const historyItems = await browser.history.search({
      'text': query,
      'startTime': 1000 * 60 * 60 * 24 * 356 * 20 // 20 years
    });
    
  return historyItems
    .filter(h => h.url !== undefined /*&& isNotSpecificDomains(h.url)*/)
    .map(history => {
      return {
        url: history.url,
        description: history.title + '\n' + extractHostname(history.url ?? ""),
        type: 'history'
      };
    });
};

// https://developer.chrome.com/docs/extensions/reference/bookmarks/
const bookmarkFinder = async (query: string): Promise<SearchResult[]> => {
  const bookmarks = await browser.bookmarks.search(query);
  return bookmarks.map(bookmark => {
    return {
      url: bookmark.url,
      description: bookmark.title + (bookmark.url === undefined ? "" : ('\n' + extractHostname(bookmark.url))),
      type: 'bookmark'
    };
  });
};

const clearListView = () => {
  const list = document.getElementById('listView');
  list!.innerHTML = '';
};

const removeDuplicates = <T, S>(arr: T[], f: (e: T) => S) => {
  const found = new Set<S>();
  const results = [];
  for(let i=0; i<arr.length; i++) {
    const k = f(arr[i]);
    if(!found.has(k)) {
      found.add(k);
      results.push(arr[i]);
    }
  }
  return results;
}

const arrayMinus = <S, T, V>(arr1: S[], arr2: T[], f1: (e: S) => V, f2: (e: T) => V) => {
  const keys = new Set(arr2.map(e => f2(e)));
  const results = [];
  for(let i=0; i<arr1.length; i++) {
    if(!keys.has(f1(arr1[i]))) {
      results.push(arr1[i]);
    }
  }
  return results;
};

const appendToListView = (results_: SearchResult[]) => {

  const list = document.getElementById('listView');
  if(list === null) throw new Error("appendToListView");
  
  const existing_urls =
    [...list.children].filter(e => e.tagName === 'LI' && e.children.length >= 1 && (e.children[0] as HTMLAnchorElement).href).map(e => (e.children[0] as HTMLAnchorElement).href);
  
  console.log(existing_urls);
  // TODO: すでにリストにあるURLを除外
  const results =
    arrayMinus(
      removeDuplicates(results_, e => e.url),
      existing_urls, e => e.url, e => e);
  
  results.forEach(result => {
    const aElem = document.createElement('a');
    if(result.url !== undefined) {
      aElem.setAttribute('href', result.url);
    }
    aElem.innerText = result.description;
    aElem.onclick = e => {
      // open a link in a new tab in background
      e.preventDefault();
      browser.tabs.create({url: aElem.href, active: false});
    };
    
    const liElement = document.createElement("li");
    liElement.appendChild(aElem);
    liElement.className = 'result-body ' + 'item-' + result.type;
    
    list.appendChild(liElement);
  });
};

const addWaitingIcon = () => {
  const list = document.getElementById('listView');
  const elm = document.createElement('li');
  elm.id = 'waitingIcon';
  elm.innerText = 'Loading ...';
  list?.appendChild(elm);
}

const removeWaitingIcon = () => {
  const elm = document.getElementById('waitingIcon');
  if (elm !== null) {
    elm.remove();
  }
}

const search = async () => {
  clearListView();
  
  addWaitingIcon();
  
  const searchQuery = document.getElementById('searchQuery') as HTMLInputElement;
  
  const scrapboxResults =
    projects.map(async project => {
      //TODO: refactor
      const results = await scrapboxFinder(project, searchQuery.value);
      appendToListView(results);
    });
  
  if((document.getElementById('search-hatebu') as HTMLInputElement).checked) {
    scrapboxResults.push((async () => {
      const results = await hatenaBookmarkFinder(searchQuery.value)
        .catch(() => { console.log("Warning: error occured in hatebu"); return []; });
      appendToListView(results);
    })());
    scrapboxResults.push((async () => {
      const results = await zennFinder(searchQuery.value)
        .catch(() => { console.log("Warning: error occured in zenn"); return []; });
      appendToListView(results);
    })());
    scrapboxResults.push((async () => {
      const results = await historyFinder(searchQuery.value)
        .catch(() => { console.log("Warning: error occured in history"); return []; });
      appendToListView(results);
    })());
    scrapboxResults.concat((async () => {
      const results = await bookmarkFinder(searchQuery.value)
        .catch(() => { console.log("Warning: error occured in bookmark"); return []; });
      appendToListView(results);
    })());
  }
  
  await Promise.all(scrapboxResults);
  
  removeWaitingIcon();
};

const projects: string[] = [];

const init = async () => {
  const data = await browser.storage.sync.get(['projects', 'search_hatebu']);
  (data.projects === undefined ? [] : data.projects).forEach((project: string) => {
    //TODO: should check stored data is valid for security
    projects.push(project);
  });
    
  (document.getElementById('search-hatebu') as HTMLInputElement).checked =
    data.search_hatebu === undefined ? false : true;
  
  document.getElementById('searchForm')!.onsubmit = async (e) => {
    e.preventDefault();
    
    await search();
  };

  document.getElementById('search-hatebu')!.onchange = async (e: Event) => {
    await browser.storage.sync.set({ 'search_hatebu': (e.target as HTMLInputElement).checked});
  };
};

init();
