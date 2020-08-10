import React from 'react';
import './App.css';
import Search from './Search.js';
import { BrowserRouter as Router, Link } from 'react-router-dom';
import Analytics from "./Analytics";

class App extends React.Component {
    render() {
        return <Router>
            <Analytics></Analytics>
            <div className="App">
                <header>
                    <img src="/logo.png" alt="Making Do Recipes Logo"></img>
                </header>
                <main>
                    <Search></Search>
                </main>
            </div>
            <footer>
                &copy; {new Date().getFullYear()} Making Do Recipes * <a href='mailto:admin@makingdorecipes.com'>Contact Us</a> * <Link to="/about">About</Link> * <Link to="/instructions">Instructions</Link> * <Link to="/disclaimer">Disclaimer</Link>
            </footer>
        </Router>
    }
}

export default App;
