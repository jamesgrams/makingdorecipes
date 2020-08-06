import React from 'react';
import './App.css';
import Search from './Search.js';
import { BrowserRouter as Router } from 'react-router-dom';

class App extends React.Component {
    render() {
        return <Router>
            <div className="App">
                <header>
                    <img src="/logo.png" alt="Making Do Recipes Logo"></img>
                </header>
                <main>
                    <Search></Search>
                </main>
            </div>
            <footer>
                &copy; {new Date().getFullYear()} Making Do Recipes * <a href='mailto:admin@makingdorecipes.com'>Contact Us</a>
            </footer>
        </Router>
    }
}

export default App;
