import React from 'react';
import './ResultList.css';
import ResultListItem from "./ResultListItem.js";
import {
    Route,
    Link
} from "react-router-dom";
import Modal from "./Modal.js";
import InfiniteScroll from "react-infinite-scroll-component";

class ResultList extends React.Component {

    /**
     * Constructor.
     * @param {Array} props - The props to pass in on initialization.
     */
    constructor(props) {
        super(props);
        this.state = {
            "results": [],
            "noMoreResults": false,
            "total": 0,
            "pseudoDataLength": 0
        };
        this.setFormTags = props.setFormTags;
        this.fetchRecipes = props.fetchRecipes;
        this.getParentResultsFaded = props.getParentResultsFaded;

        this.setRecipeModalContent = this.setRecipeModalContent.bind(this);
    }

    /**
     * Called upon component mount.
     * We'll fetch the recipe if determined necessary.
     */
    componentDidMount() {
        if( this.needsToFetch ) {
            this.fetchRecipes(false, this.needsToFetch).then( (response) => {
                if( response.recipes.length ) {
                    this.setState({"results": response.recipes}, () => {
                        this.getResultItems();
                        this.setRecipeModalContent( this.needsToFetch );
                        this.needsToFetch = "";
                    });
                }
                else {
                    window.location.href = "/";
                }
            } ).catch(err => {
                window.location.href = "/";
            })
        }
    }

    /**
     * Set recipe modal content.
     * This will either find the content on the page and pop it out
     * or fetch the content if it is not on the page.
     */
    setRecipeModalContent( id ) {
        // see if we already have the necessary results on the page
        let listItem = null;
        try {
            listItem = this.resultItems.filter( el => el.props.children.props.id === id )[0];
        }
        catch(err) {}
        if( !listItem ) {
            this.needsToFetch = id;
            return;
        }

        listItem = listItem.props.children;
        let popout = <ResultListItem isModal={true} id={listItem.props.id} name={listItem.props.name} tags={listItem.props.tags} schemaTags={listItem.props.schemaTags} ingredients={listItem.props.ingredients} schemaIngredients={listItem.props.schemaIngredients} steps={listItem.props.steps} schemaSteps={listItem.props.schemaSteps} credits={listItem.props.credits} schemaCredits={listItem.props.schemaCredits} schemaImages={listItem.props.schemaImages} raw={listItem.props.raw}></ResultListItem>;

        return <Modal query={this.props.searchQuery} content={popout}></Modal>;
    }

    /**
     * Get result items from the result list.
     */
    getResultItems() {
        this.resultItems = this.state.results.map( (el) => {
            // Map the tests
            let schemaTags = [];
            let tags = el.tag.map( (tag) => {
                schemaTags.push(tag.name);
                return <span key={tag.name} className="react-tagsinput-tag" onClick={(e)=>{e.stopPropagation(); e.preventDefault(); this.setFormTags([tag.name])}}>{tag.name}</span>
            } );
            // Map the ingredients display
            let schemaIngredients = [];
            let ingredients = el.ingredient.map( (ingredient, index) => {
                let schemaIngredient = [];
                let options = ingredient.option.map( (option) => {
                    let allergens = option.allergen.map( (allergen) => {
                        return <span key={allergen.name} className="ResultListItemAllergen">{allergen.name}</span>
                    } ).reduce((acc, x) => acc === null ? [x] : [acc, ', ', x], null);
                    schemaIngredient.push(option.quantity + " " + option.name);
                    return <span key={option.name} className="ResultListItemOption">
                        <span className="ResultListItemOptionName">{option.quantity + " " + option.name}</span>
                        <span className={"ResultListItemAllergens " + (!option.allergen.length ? "hidden" : "")}>({allergens})</span>
                    </span>
                } ).reduce((acc, x, idx) => acc === null ? [x] : [acc, <b key={"bold--" + idx}> / </b>, x], null);
                schemaIngredients.push( schemaIngredient.join(" / ") );
                return <li key={index} className="ResultListItemIngredient">{options}</li>
            } );
            let credits;
            let schemaCredits;
            if( el.credit ) {
                let content = el.credit.name;
                schemaCredits = {
                    "@type": "Person",
                    "name": el.credit.name
                }
                if( el.credit.link ) {
                    let link;
                    if( el.credit.link.match(/^http|^mailto/) ) {
                        link = el.credit.link;
                    }
                    else if( el.credit.link.match(/^([a-zA-Z0-9_\-.]+)@([a-zA-Z0-9_\-.]+)\.([a-zA-Z]{2,5})$/) ) {
                        link = "mailto:" + el.credit.link;
                    }
                    else {
                        link = "https://" + el.credit.link;
                    }
                    content = <a onClick={(e) => e.stopPropagation()} target="_blank" rel="noopener noreferrer" href={link}>{content}</a>
                    
                    if( link.match(/^mailto:/) ) {
                        schemaCredits.email = link.replace(/^mailto:/,"");
                    }
                    else {
                        schemaCredits.url = link;
                    }
                }
                credits = <span className="ResultListItemCredit">
                    {content}
                </span>
            }
            
            let schemaSteps = [];
            let stepsHtml = document.createElement("div");
            stepsHtml.innerHTML = el.steps;
            let steps = stepsHtml.querySelector("ul,ol");
            if( steps ) {
                schemaSteps = Array.from(steps.children).map(el => {
                    return {
                        "@type": "HowToStep",
                        "text": el.innerText.trim()
                    }
                });
            }
            let schemaImages = Array.from(stepsHtml.querySelectorAll("img")).map(el => el.getAttribute("src"));
            if( !schemaImages.length ) schemaImages.push("https://makingdorecipes.com/logo.png"); 

            return <Link key={el.id} to={"/recipe/"+el.id} onClick={(e) => {
                if(this.getParentResultsFaded()) {
                    e.stopPropagation();
                    e.preventDefault();
                }
            }}>
                <ResultListItem isModal={false} id={el.id} name={el.name} tags={tags} schemaTags={schemaTags} ingredients={ingredients} schemaIngredients={schemaIngredients} steps={el.steps} schemaSteps={schemaSteps} credits={credits} schemaCredits={schemaCredits} schemaImages={schemaImages} raw={el}></ResultListItem>
            </Link>
        });
    }

    /**
     * Render the element.
     */
    render() {
        this.getResultItems(); // needed out here for direct loading of recipe.
        let responseVal = <Route path="/recipe/:id" render={({match}) => {
            return this.setRecipeModalContent( match.params.id );
        }}/>;
        if( this.state.total ) {
            responseVal = <ul className="ResultList">
                <div className={"ResultListTotal " + (this.state.total ? "" : "hidden")}>
                    {this.state.total} Result{this.state.total !== 1 ? "s" : ""}
                </div>
                <InfiniteScroll
                    dataLength={this.state.pseudoDataLength}
                    next={() => {
                        this.fetchRecipes(null,null,this.state.results.length,this.props.seed).then( (json) => {
                            if( json.recipes.length ) {
                                let results = this.state.results;
                                results = results.concat(json.recipes);
                                this.setState({results:results,pseudoDataLength:results.length});
                            }
                            else {
                                this.setState({noMoreResults:true,pseudoDataLength:this.state.results.length+1});
                            }
                        } );
                    }}
                    hasMore={!this.state.noMoreResults}
                    loader={<div className="ResultListScrollLoading">Loading...</div>}
                >
                    {this.resultItems}
                </InfiniteScroll>
                {responseVal}
            </ul>;
        }
        return responseVal;
    }
}

export default ResultList;