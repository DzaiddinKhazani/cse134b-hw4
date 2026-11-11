// <hello-world> custom element: logs a message to the console when it is
// placed on the page. It does not touch the DOM (no shadow root, no innerHTML).
customElements.define('hello-world', class extends HTMLElement {
  connectedCallback() {
    console.log('Hello World!');
  }
});