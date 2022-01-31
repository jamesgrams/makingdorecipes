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
                    <picture>
                        <source srcSet="/logo-small.webp" type="image/webp"/>
                        <source srcSet="/logo-small.png" type="image/png"/> 
                        <img alt="Making Do Recipes Logo" src="/logo-small.png"/>
                    </picture>
                </header>
                <main>
                    <Search></Search>
                </main>
            </div>
            <footer>
                &copy; {new Date().getFullYear()} Making Do Recipes * <a href='mailto:admin@makingdorecipes.com'>Contact Us</a> * <Link to="/about">About</Link> * <Link to="/instructions">Instructions</Link> * <Link to="/disclaimer">Disclaimer</Link> * <a href='https://www.facebook.com/makingdorecipes' rel="noopener noreferrer" target="_blank">Facebook</a>
                <div className="featured">
                    <div>Featured by:</div>
                    <a href="https://fpiesfoundation.org/interview-with-making-do-recipes" target="_blank" rel="noopener noreferrer">
                        <picture>
                            <source srcSet="/thefpiesfoundation.webp" type="image/webp"/>
                            <source srcSet="/thefpiesfoundation.png" type="image/png"/>
                            <img alt="The FPIES Foundation logo" src="/thefpiesfoundation.png"/>
                        </picture>
                    </a>
                </div>
            </footer>
        </Router>
    }
}

export default App;
