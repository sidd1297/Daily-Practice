(function() {
  const SIDEBAR_ID = 'true-lens-sidebar';
  const IFRAME_ID = 'true-lens-iframe';

  function toggleSidebar() {
    const existingSidebar = document.getElementById(SIDEBAR_ID);
    if (existingSidebar) {
      const isVisible = existingSidebar.style.width !== '0px';
      if (isVisible) {
        existingSidebar.style.width = '0px';
        document.body.style.marginRight = '0px';
      } else {
        existingSidebar.style.width = '350px';
        document.body.style.marginRight = '350px';
      }
    } else {
      createSidebar();
    }
  }

  function createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.id = SIDEBAR_ID;
    sidebar.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 350px;
      height: 100%;
      z-index: 2147483647;
      background: #F1F2F6;
      border-left: 1px solid #dfe4ea;
      box-shadow: -2px 0 8px rgba(0,0,0,0.1);
      transition: width 0.3s ease;
      overflow: hidden;
    `;

    const iframe = document.createElement('iframe');
    iframe.id = IFRAME_ID;
    iframe.src = chrome.runtime.getURL('sidebar/sidebar.html');
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
    `;

    sidebar.appendChild(iframe);
    document.body.appendChild(sidebar);
    document.body.style.transition = 'margin-right 0.3s ease';
    document.body.style.marginRight = '350px';

    iframe.onload = () => {
      const articleText = scrapeArticleContent();
      if (articleText) {
        chrome.runtime.sendMessage({ type: 'ANALYZE_CONTENT', content: articleText });
      } else {
        postErrorToSidebar('Could not find article content on this page.');
      }
    };
  }

  function scrapeArticleContent() {
    const selectors = ['article', 'main', 'div[role="main"]'];
    let mainContentElement = null;

    for (const selector of selectors) {
      mainContentElement = document.querySelector(selector);
      if (mainContentElement) break;
    }

    if (!mainContentElement) {
      let maxParagraphs = 0;
      const allDivs = document.querySelectorAll('div');
      allDivs.forEach(div => {
        const pCount = div.querySelectorAll('p').length;
        if (pCount > maxParagraphs && div.clientHeight > 200) {
          maxParagraphs = pCount;
          mainContentElement = div;
        }
      });
    }

    if (mainContentElement) {
      const paragraphs = mainContentElement.querySelectorAll('p');
      return Array.from(paragraphs).map(p => p.textContent.trim()).join('\n\n');
    }

    return document.body.innerText.substring(0, 15000);
  }

  function postErrorToSidebar(errorMessage) {
    const iframe = document.getElementById(IFRAME_ID);
    if (iframe) {
      iframe.contentWindow.postMessage({ type: 'ANALYSIS_ERROR', error: errorMessage }, '*');
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const iframe = document.getElementById(IFRAME_ID);
    if (iframe) {
      iframe.contentWindow.postMessage(request, '*');
    }
  });

  toggleSidebar();
})();