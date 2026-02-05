import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

/**
 * Questo è il punto di ingresso principale di React.
 * Prende il componente <App /> e lo inietta nel div "root"
 * che abbiamo definito nel file index.html.
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)