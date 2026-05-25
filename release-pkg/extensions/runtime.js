// Runtime de compatibilidad con Miru/JiruHub Extension API
class Extension {
  async request(path, options = {}) {
    let url = path;
    if (options.headers && options.headers['Miru-Url']) {
      url = options.headers['Miru-Url'];
    }
    if (!url.startsWith('http')) {
      url = (this.baseUrl || '') + url;
    }
    try {
      const res = await invoke('fetch_url', { url });
      return res;
    } catch (e) {
      const res = await fetch(url);
      return await res.text();
    }
  }

  async querySelector(html, selector) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const el = doc.querySelector(selector);
    if (!el) return { text: '', getAttributeText: () => '', content: '' };
    return {
      text: el.textContent || '',
      getAttributeText: (attr) => el.getAttribute(attr) || '',
      content: el.outerHTML || '',
    };
  }

  async querySelectorAll(html, selector) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const elements = doc.querySelectorAll(selector);
    return Array.from(elements).map(el => ({
      text: el.textContent || '',
      getAttributeText: (attr) => el.getAttribute(attr) || '',
      content: el.outerHTML || '',
    }));
  }

  async getAttributeText(html, selector, attr) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const el = doc.querySelector(selector);
    return el ? el.getAttribute(attr) || '' : '';
  }
}
