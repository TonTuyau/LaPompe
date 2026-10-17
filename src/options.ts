import './pages/theme.css'
import { mount } from 'svelte'
import Options from './pages/Options.svelte'

mount(Options, { target: document.getElementById('app') as HTMLElement })
