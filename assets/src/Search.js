import React from 'react';
import './Search.css';
///import 'react-tagsinput/react-tagsinput.css';
import ResultList from "./ResultList.js";
import TagsInput from 'react-tagsinput';
import Autosuggest from 'react-autosuggest'
import {
    Link,
    Route
} from "react-router-dom";
import Modal from './Modal';
import Submit from "./Submit";
import cookie from 'react-cookies';
import Helmet from 'react-helmet';

const SAFES_TITLE = "Match recipes containing only the listed items";
const ALLERGENS_TITLE = "Match recipes that don't contain the listed items";

/**
 * The search form and results.
 */
class Search extends React.Component {

    /**
     * Constructor
     * @param {Object} props - Props to pass into the React Component. 
     */
    constructor(props) {
        super(props);

        this.state = {
            "resultsErrorShown": false,
            "resultsError": "",
            "gettingResults": false,
            "itemsSuggestions": [],
            "tagsSuggestions": [],
            "recipeSuggestions": [],
            "isAdmin": cookie.load("making-do-recipes-token") ? true : false
        }
        this.state = {...this.state, ...this.getStateFromParams()};

        let thisRef = this;
        window.onpopstate = function() {
            let currentStateToCompare = {
                "search": thisRef.state.search,
                "items": thisRef.state.items,
                "safesMode": thisRef.state.safesMode,
                "tags": thisRef.state.tags,
                "flexibility": thisRef.state.flexibility,
                "moreShown": thisRef.state.moreShown,
                "unapproved": thisRef.state.unapproved,
                "resultsShown": thisRef.state.resultsShown
            }
            // we only need to reload if the search is different
            if( JSON.stringify(currentStateToCompare) !== JSON.stringify(thisRef.getStateFromParams()) ) {
                thisRef.setState(thisRef.getStateFromParams(), thisRef.componentDidMount);
            }
        }

        this.overrideAddMaskWarning = false;
        this.shouldSetUrl = false;

        this.resultList = React.createRef();

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.setFormTags = this.setFormTags.bind(this);
        this.autocompleteTagInput = this.autocompleteTagInput.bind(this);
        this.setUrl = this.setUrl.bind(this);
    }

    /**
     * If there are params, search on load.
     */
    componentDidMount() {
        if( window.location.pathname === "/" ) { // don't do anything if we are on a recipe
            if( this.state.resultsShown ) { // this should be fetched from the parameters at this point
                this.handleSubmit(null, true);
            }
            else {
                this.setState({resultsShown: false, resultsErrorShown: false});
            }
        }
    }

    /**
     * Get values for state from parameters.
     */
    getStateFromParams() {
        // Get query string parameters
        let search = window.location.search;
        let params = new URLSearchParams(search);
        return {
            "search": params.get("search") || "",
            "items": params.get("items") ? params.get("items").split(",") : [],
            "safesMode": params.get("safesMode") === "false" ? false : true,
            "tags": params.get("tags") ? params.get("tags").split(",") : [],
            "flexibility": params.get("flexibility") || 0, // these first five are for the form
            "moreShown": params.get("tags") || params.get("flexibility") || params.get("unapproved") ? true : false,
            "unapproved": params.get("unapproved") === "true" ? true : false, // default to false
            "resultsShown": params.get("resultsShown") === "true" ? true : false, // default to false
        };
    }

    /**
     * Set the url from the state.
     * @param {boolean} replaceState - True if the state should be replaced.
     */
    setUrl( replaceState ) {
        let paramsObject = {
            search: this.state.search,
            tags: this.state.tags.join(","),
            flexibility: this.state.flexibility ? this.state.flexibility : "",
            items: this.state.items.join(","),
            safesMode: this.state.safesMode ? "" : false, // safesMode defaults to true
            unapproved: this.state.unapproved ? true : "", // unapproved defaults to false
            resultsShown: this.state.resultsShown ? true : "" // resultsShown defaults to false 
        }
        for( let key in paramsObject ) {
            if( paramsObject[key] === "" ) {
                delete paramsObject[key];
            }
        }
        let params = new URLSearchParams(Object.entries(paramsObject));
        let newUrl = Object.keys(paramsObject).length ? "?" + params.toString() : "";
        window.history[ replaceState ? "replaceState" : "pushState" ]( {}, "", newUrl );
    }

    /**
     * Set Form Tags. Can be passed to children.
     * @param {Array<String>} tags - The tags to set. 
     */
    setFormTags( tags ) {
        let currentTags = this.state.tags;
        let filteredTags = [];
        for( let tag of tags ) {
            if( this.state.tags.indexOf(tag) === -1 ) filteredTags.push(tag);
        }
        currentTags = currentTags.concat(filteredTags);
        this.setState({tags: currentTags});
    }

    /**
     * Handle a change to the form. Note that this is for values and not really what is displayed on the page.
     * @param {Event} event - The event. 
     */
    handleChange(event) {
        let name = event.target.name;
        let value = (name === "safesMode" || name === "unapproved") ? event.target.checked : event.target.value;
        if( event.target.className.includes("inverse") ) value = !value;
        // Set State redraws components as necessary
        this.setState({ [name]: value });
    }

    /**
     * Fetch recipes.
     * @param {boolean} [prefix] - True if this is a prefix search.
     * @param {string} [id] - The id of the recipe.
     * @returns {Promise<Object>} - A promise containing the fetched object.
     */
    fetchRecipes( prefix, id ) {
        let promise = new Promise( (resolve, reject) => {

            let paramsObject = {};
            if( id ) paramsObject.id = id;
            else {
                paramsObject = {
                    search: this.state.search,
                    tags: this.state.tags.join(","),
                    flexibility: this.state.flexibility ? this.state.flexibility : "",
                }
                if( this.state.safesMode ) {
                    paramsObject.safes = this.state.items.join(",");
                }
                else {
                    paramsObject.allergens = this.state.items.join(",");
                }
                if( this.state.unapproved ) {
                    paramsObject.unapproved = true;
                }
                if( prefix ) {
                    paramsObject.prefix = true;
                }
            }
            
            let params = new URLSearchParams(Object.entries(paramsObject));
            fetch( "/recipe?" + params ).then( (response) => {
                response.json().then( (json) => {
                    resolve( json );
                } ).catch( err => {
                    reject(err);
                } );
            } ).catch(err => {
                reject(err);
            });

        });

        return promise;
    }

    /**
     * Handle the form submission.
     * @param {Event} event - The event.
     * @param {boolean} [noUrl] - True if we should not update the url.
     */
    handleSubmit(event, noUrl) {
        if(event) event.preventDefault();
        if( this.state.gettingResults ) return;
        this.setState({"gettingResults": true, "resultsErrorShown": false, "resultsShown": false}, () => {

            this.fetchRecipes().then( (json) => {
                this.setState({"gettingResults": false});
                this.resultList.current.setState({results: json.recipes});
                if( json.recipes.length ) this.setState({resultsShown: true}, () => {if(!noUrl)this.setUrl()});
                else this.setState({resultsError: "No recipes found.", resultsErrorShown: true}, () => {if(!noUrl)this.setUrl()});
            } ).catch(err => {
                this.setState({"gettingResults": false});
                this.setState({resultsError: "Could not fetch recipes, please try again later.", resultsErrorShown: true})
            });

        });
    }

    /**
     * Autocomplete render input to suggest tags.
     * @param {Object} param0 - The parameters that react-autocomplete expects. 
     * @param {string} endpoint - The endpoint to fetch from. 
     */
    autocompleteTagInput({addTag, ...props}, endpoint) {
        let handleOnChange = (e, {newValue, method}) => {
            if( method === 'enter') e.preventDefault();
            else props.onChange(e);
        }

        let suggestions = "itemsSuggestions";
        let responseKey = "allergens";
        if( endpoint === "tag" ) {
            suggestions = "tagsSuggestions";
            responseKey = "tags";
        }
        
        return (
            <Autosuggest
                ref={props.ref}
                suggestions={this.state[suggestions]}
                shouldRenderSuggestions={(value) => value && value.trim().length > 0}
                getSuggestionValue={(suggestion) => suggestion}
                renderSuggestion={(suggestion) => <span>{suggestion}</span>}
                inputProps={{...props, onChange: handleOnChange}}
                onSuggestionSelected={(e, {suggestion}) => {
                    addTag(suggestion)
                }}
                onSuggestionsClearRequested={() => { this.setState({ [suggestions]: [] } ) }}
                onSuggestionsFetchRequested={({value}) => {
                    fetch("/" + endpoint + "?search=" + value).then(response => response.json()).then( data => {
                        this.setState({ [suggestions]: data[responseKey] } )
                    })
                }}
            />
        )
    }

    /**
     * Render this component.
     */
    render() {
        let metaTitle = "Making Do Recipes"; // These should match what we set initially in index.html
        let metaDescription = "Find delicious recipes to make that are compatible with your or your child's allergies.";
        let metaImg = "https://makingdorecipes.com/logo.png"; 

        return <div className="Search">
            <Helmet>
                <title>{metaTitle}</title>
                <meta
                    name="description"
                    content={metaDescription}
                />
                <meta property="og:title" content={metaTitle}/>
                <meta property="og:type" content="website"/>
                <meta property="og:url" content="https://makingdorecipes.com"/>
                <meta propery="og:description" content={metaDescription}/>
                <meta property="og:image" content={metaImg}/>
                <meta property="twitter:card" content="summary"/>
                <meta property="twitter:title" content={metaTitle}/>
                <meta propery="twitter:description" content={metaDescription}/>
                <meta property="twitter:image:src" content={metaImg}/>
            </Helmet>
            <form className="SearchForm">
                <div className="SearchRow">
                    <label title="Search for recipe names">
                        <span className="SearchLabelText">Search:</span>
                        <Autosuggest
                            suggestions={this.state.recipeSuggestions}
                            shouldRenderSuggestions={(value) => value && value.trim().length > 2}
                            onSuggestionsFetchRequested={({value}) => {
                                this.fetchRecipes(true).then( (json) => {
                                    this.setState({
                                        "recipeSuggestions": json.recipes.map(recipe => recipe.name)
                                    })
                                } );
                            }}
                            onSuggestionsClearRequested={() => { this.setState({ "recipeSuggestions": [] } ) }}
                            getSuggestionValue={(suggestion) => suggestion}
                            renderSuggestion={(suggestion) => <span>{suggestion}</span>}
                            inputProps={{
                                name: "search",
                                type: "search",
                                value: this.state.search,
                                onChange: this.handleChange
                            }}
                            onSuggestionSelected={(e, {suggestion}) => {
                                console.log(suggestion);
                                this.setState({"search":suggestion}, this.handleSubmit);
                            }}
                            >
                        </Autosuggest>
                    </label>
                </div>
                <div className="SearchRow">
                    <div className="SearchColumn">
                        <label className="SearchLabelRadio" title={SAFES_TITLE}>
                            <span>Safes:</span>
                            <input
                                name="safesMode"
                                type="radio"
                                checked={this.state.safesMode}
                                onChange={this.handleChange} />
                        </label>
                        <label className="SearchLabelRadio" title={ALLERGENS_TITLE}>
                            <span>Allergens:</span>
                            <input
                                className = "inverse"
                                name="safesMode"
                                type="radio"
                                checked={!this.state.safesMode}
                                onChange={this.handleChange} />
                        </label>
                    </div>
                    <label>
                        <span className="SearchLabelText" title={this.state.safesMode ? SAFES_TITLE : ALLERGENS_TITLE}>Items:</span>
                        <TagsInput
                            renderInput={({addTag, ...props}) => this.autocompleteTagInput({addTag, ...props}, "allergen")}
                            inputProps={{className: "react-tagsinput-input",placeholder: "Add " + (this.state.safesMode ? "safe" : "allergen")}}
                            onlyUnique="true"
                            name="items"
                            value={this.state.items}
                            addOnBlur={true}
                            onChange={(tags) => this.setState({items: tags})} />
                    </label>
                </div>
                <div className={"SearchRow " + (this.state.moreShown ? "" : "hidden")}>
                    <label title="Filter recipes by tags">
                        <span className="SearchLabelText">Tags:</span>
                        <TagsInput
                            renderInput={({addTag, ...props}) => this.autocompleteTagInput({addTag, ...props}, "tag")}
                            inputProps={{className: "react-tagsinput-input",placeholder: "Add tag"}}
                            onlyUnique="true"
                            name="tags"
                            value={this.state.tags}
                            addOnBlur={true}
                            onChange={(tags) => this.setState({tags: tags})} />
                    </label>
                    <label className="SeachFlexibilityLabel" title="Allow for this number of bad ingredients">
                        <span className="SearchLabelText">Flexibility:</span>
                        <input
                            name="flexibility"
                            type="number"
                            value={this.state.flexibility}
                            onChange={this.handleChange} />
                    </label>
                </div>
                <div className={"SearchRow " + (this.state.moreShown && this.state.isAdmin ? "" : "hidden")}>
                    <label className="SearchLabelCheckbox" title="Show unapproved">
                        <span>Unapproved:</span>
                        <input
                            name="unapproved"
                            type="checkbox"
                            checked={this.state.unapproved}
                            onChange={this.handleChange} />
                    </label>
                </div>
                <div className="SearchRow">
                    <div className="SearchMoreWrapper">
                        <div className = "SearchMore" onClick={(e) => this.setState({moreShown: !this.state.moreShown})}>{this.state.moreShown ? "Show Less" : "Show More"}</div>
                    </div>
                    <button onClick={this.handleSubmit} disabled={this.state.gettingResults ? "disabled" : ""}>Search</button>
                </div>
            </form>
            <div className={"SearchResults " + (this.state.resultsShown ? "" : "hidden")}>
                <ResultList ref={this.resultList} setFormTags={this.setFormTags} fetchRecipes={this.fetchRecipes} setShouldSetUrl={() => this.shouldSetUrl = true}></ResultList>
            </div>
            <div className={"SearchResultsError " + (this.state.resultsErrorShown ? "" : "hidden")}>
                {this.state.resultsError}
            </div>
            <Route exact path="/" render={() => {if(this.shouldSetUrl) {this.shouldSetUrl = false; if(this.state.resultsShown) this.setUrl(true);}}}></Route>
            <Link to="/add" className="SearchAddLink">
                +
            </Link>
            <Route path="/add" render={() => <Modal className="SubmitModalContent" content={<Submit setOverrideAddMaskWarning={(set) => this.overrideAddMaskWarning = set} autocompleteTagInput={this.autocompleteTagInput}></Submit>} onclick={(e) => {
                if( this.overrideAddMaskWarning || window.confirm("Are you sure you want to close this form?") ) {
                    this.shouldSetUrl = true;
                }
                else {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }}></Modal>}/>
        </div>
    }
}

export default Search;
