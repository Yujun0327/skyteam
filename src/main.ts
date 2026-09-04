import { mount } from 'svelte'
import '@fontsource/b612/400.css'
import '@fontsource/b612/700.css'
import '@fontsource/b612-mono/400.css'
import '@fontsource/b612-mono/700.css'
import '@fontsource/michroma/400.css'
import './app.css'
import App from './App.svelte'

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
