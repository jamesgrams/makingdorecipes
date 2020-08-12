import React from 'react';
import './Search.css';
///import 'react-tagsinput/react-tagsinput.css';
import ResultList from "./ResultList.js";
import TagsInput from 'react-tagsinput';
import Autosuggest from 'react-autosuggest'
import {
    Link,
    Route,
    withRouter
} from "react-router-dom";
import Modal from './Modal';
import Submit from "./Submit";
import cookie from 'react-cookies';
import Helmet from 'react-helmet';
import Disclaimer from './Disclaimer.js';
import About from './About';
import Instructions from './Instructions';

const SAFES_TITLE = "Match recipes containing only the listed items";
const ALLERGENS_TITLE = "Match recipes that don't contain the listed items";
const COULD_NOT_SUBSCRIBE = "Could not subscribe.";

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
            "resultsFaded": false,
            "gettingResults": false,
            "itemsSuggestions": [],
            "tagsSuggestions": [],
            "recipeSuggestions": [],
            "seed": 0,
            "currentQuery": window.location.pathname === "/" ? window.location.search : "",
            "isAdmin": cookie.load("making-do-recipes-token") ? true : false,
            "forcePromptSubscribe": false,
            "subscribed": false,
            "subscribedError": "",
            "subscribing": false,
            "subscriptionEmail": "",
            "subscriptionUrl": ""
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
            if( window.location.pathname === "/" && JSON.stringify(currentStateToCompare) !== JSON.stringify(thisRef.getStateFromParams()) ) {
                thisRef.setState(thisRef.getStateFromParams(), thisRef.componentDidMount);
            }
        }

        this.overrideAddMaskWarning = false;

        this.resultList = React.createRef();

        let possItems = ["Sugar Cookies","Fudge Pops","Pancakes","Peanut Butter Cookies","Old Fashioned Donuts","Chicken Fingers","Blueberry Donuts"];
        this.searchPlaceholder = possItems[Math.floor(Math.random()*possItems.length)];

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.setFormTags = this.setFormTags.bind(this);
        this.autocompleteTagInput = this.autocompleteTagInput.bind(this);
        this.setUrl = this.setUrl.bind(this);
        this.fetchRecipes = this.fetchRecipes.bind(this);
        this.getStateFromParams = this.getStateFromParams.bind(this);
        this.subscribeEmail = this.subscribeEmail.bind(this);
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
        let newUrl = this.getUrl();

        // use react-router (history is defined because we wrap with withRouter)
        this.props.history[replaceState ? "replace" : "push"](newUrl);
        this.setState({"currentQuery": newUrl});
    }

    /**
     * Get URL from the state.
     * @returns {String} - The url to return.
     */
    getUrl() {
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
        return Object.keys(paramsObject).length ? "?" + params.toString() : "";
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
        this.setState({tags: currentTags,moreShown:true});
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
     * @param {string} [from] - Where to start from
     * @param {string} [seed] - The seed to start random from.
     * @returns {Promise<Object>} - A promise containing the fetched object.
     */
    fetchRecipes( prefix, id, from, seed ) {
        let promise = new Promise( (resolve, reject) => {

            // When we specficy from, we want to get more results based on the search
            // the user has already made, regardless of how they have changed the top form
            // This search is in the URL params conveniently
            let state = (!from && from !== 0) ? this.state : this.getStateFromParams();

            let paramsObject = {};
            if( id ) paramsObject.id = id;
            else {
                paramsObject = {
                    search: state.search,
                    tags: state.tags.join(","),
                    flexibility: state.flexibility ? state.flexibility : "",
                }
                if( state.safesMode ) {
                    paramsObject.safes = state.items.join(",");
                }
                else {
                    paramsObject.allergens = state.items.join(",");
                }
                if( state.unapproved ) {
                    paramsObject.unapproved = true;
                }
                if( prefix ) {
                    paramsObject.prefix = true;
                }
                if( from ) {
                    paramsObject.from = from;
                }
                if( seed ) {
                    paramsObject.seed = seed;
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
        // keep the height while 
        // fade the results if they are shown
        let seed = Math.floor(Math.random()*1000); // set a new randomness seed each time we do a search (note: not when we do infinite scroll to keep pagination)
        this.setState({"seed": seed, "gettingResults": true, "resultsErrorShown": false, "resultsShown": false, "resultsFaded": this.state.resultsShown, "forcePromptSubscribe": false, "subscribed": false, "subscribing": false, "subscribedError": "", subscriptionUrl: this.getUrl().replace(/resultsShown=(true|false)/,"")}, () => {
            this.fetchRecipes(null,null,null,this.state.seed).then( (json) => {
                this.setState({"gettingResults": false,"resultsFaded":false});
                this.resultList.current.setState({results: json.recipes, total: json.total, noMoreResults: false, pseudoDataLength: 0}, () => {
                    if( json.recipes.length ) this.setState({resultsShown: true}, () => {if(!noUrl)this.setUrl()});
                    else this.setState({resultsError: "No recipes found.", resultsErrorShown: true, "resultsShown": false, forcePromptSubscribe: true}, () => {if(!noUrl)this.setUrl()});
                });
            } ).catch(err => {
                this.setState({"gettingResults": false,"resultsFaded":false});
                this.setState({resultsError: "Could not fetch recipes, please try again later.", resultsErrorShown: true, "resultsShown": false})
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
     * Subscribe to a search result to get emails.
     * @param {Event} e - The click event.
     */
    subscribeEmail(e) {
        if( e ) {
            e.stopPropagation();
            e.preventDefault();
        }
        this.setState({"subscribing": true}, () => {
            fetch("/subscribe", { 
                method: 'POST', 
                body: JSON.stringify({
                    email: this.state.subscriptionEmail,
                    path: this.state.subscriptionUrl // If there are no results, we don't have a url to go off of, so we can't use window.location.search
                }), 
                headers: {'Content-Type': 'application/json'} 
            }).then(
                response => response.json().then( data => {
                    if( data.status === "success" ) {
                        this.setState({"subscribed": true, "subscribedError": false, "subscribing": false});
                    }
                    else {
                        this.setState({"subscribedError": COULD_NOT_SUBSCRIBE, "subscribing": false});
                    }
                })
                .catch(err => {
                    this.setState({"subscribedError": COULD_NOT_SUBSCRIBE, "subscribing": false});
                })
            ).catch(err => {
                this.setState({"subscribedError": COULD_NOT_SUBSCRIBE, "subscribing": false});
            });
        });
    }

    /**
     * Render this component.
     */
    render() {
        let metaTitle = "Making Do Recipes"; // These should match what we set initially in index.html
        let metaDescription = "Find delicious recipes to make that are compatible with your or your child's allergies.";

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
                <meta property="twitter:title" content={metaTitle}/>
                <meta propery="twitter:description" content={metaDescription}/>
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
                                placeholder: "e.g. " + this.searchPlaceholder,
                                onChange: this.handleChange
                            }}
                            onSuggestionSelected={(e, {suggestion}) => {
                                this.setState({"search":suggestion}, this.handleSubmit);
                                setTimeout(()=>document.activeElement.blur(),25);
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
                            min="0"
                            pattern="[0-9]*"
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
            <div className={"SearchResults " + (this.state.resultsFaded ? "faded" : (this.state.resultsShown ? "" : "hidden"))}>
                <ResultList ref={this.resultList} setFormTags={this.setFormTags} fetchRecipes={this.fetchRecipes} seed={this.state.seed} searchQuery={this.state.currentQuery} getParentResultsFaded={() => this.state.resultsFaded}></ResultList>
            </div>
            <div className={"SearchResultsError " + (this.state.resultsErrorShown ? "" : "hidden")}>
                {this.state.resultsError}
            </div>
            <div className={"SearchResultsSubscribe " + (this.state.resultsShown || this.state.resultsFaded || this.state.forcePromptSubscribe ? "" : "hidden")}>
                <label for="subscriptionEmail">
                    <span className="SearchResultsSubscribeInfo">Get alerts for new recipes that match this search</span>
                    <input placeholder="Email" onChange={this.handleChange} type="email" name="subscriptionEmail" id="subscriptionEmail" value={this.state.subscriptionEmail}/>
                        <button className={this.state.subscribed ? "subscribed" : ""} onClick={(e) => {this.subscribeEmail(e)}} disabled={(!this.state.subscriptionEmail || this.state.subscribing || this.state.subscribed) ? "disabled" : ""}>Subscribe{this.state.subscribed ? "d" : ""}</button>
                    <span className={"SubscribeEmailError " + (this.state.subscribedError ? "" : "hidden")}>{this.state.subscribedError}</span>
                </label>
            </div>
            <Route exact path="/" render={() => {}}></Route>
            <Link to="/add" className="SearchAddLink">
                +
            </Link>
            <Route path="/add" render={() => <Modal query={this.state.currentQuery} className="SubmitModalContent" content={<Submit setOverrideAddMaskWarning={(set) => this.overrideAddMaskWarning = set} autocompleteTagInput={this.autocompleteTagInput}></Submit>} onclick={(e) => {
                if( !this.overrideAddMaskWarning && !window.confirm("Are you sure you want to close this form?") ) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }}></Modal>}/>
            <Route path="/disclaimer" render={() => <Modal query={this.state.currentQuery} content={<Disclaimer></Disclaimer>}></Modal>}></Route>
            <Route path="/about" render={() => <Modal query={this.state.currentQuery} content={<About></About>}></Modal>}></Route>
            <Route path="/instructions" render={() => <Modal query={this.state.currentQuery} content={<Instructions></Instructions>}></Modal>}></Route>
        </div>
    }
}

export default withRouter(Search);
