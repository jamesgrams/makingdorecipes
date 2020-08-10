import React from 'react';
import {InlineShareButtons} from 'sharethis-reactjs';
import './ResultListItem.css';
import cookie from 'react-cookies';
import {
    Link
} from "react-router-dom";
import Helmet from "react-helmet";

class ResultListItem extends React.Component {

    /**
     * Constructor.
     * @param {Array} props - The props to pass in on initialization.
     */
    constructor(props) {
        super(props);
        this.state = {
            "isAdmin": cookie.load("making-do-recipes-token") ? true : false
        };

        this.isModal = this.props.isModal;
        this.deleteItem = this.deleteItem.bind(this);
    }

    /**
     * Delete a recipe.
     */
    deleteItem(e) {
        e.preventDefault();
        e.stopPropagation();
        if( window.confirm("Are you sure you want to delete this recipe?") ) {
            fetch("/recipe?id=" + this.props.id, {
                "method": "DELETE"
            }).then(
                response => response.json().then( data => {
                    if( data.status === "success" ) alert("Deleted recipe.");
                    else alert("Could not delete recipe.");
                })
                .catch(err => {
                    alert("Could not delete recipe.");
                })
            ).catch(err => {
                alert("Could not delete recipe.");
            });
        }
    }

    /**
     * Render the element.
     */
    render() {
        let HtmlTag = !this.isModal ? "li" : "div";

        let shareButtons = "";
        if(this.isModal) shareButtons = <InlineShareButtons
            config={{
                alignment: 'right',  // alignment of buttons (left, center, right)
                color: 'social',      // set the color of buttons (social, white)
                enabled: true,        // show/hide buttons (true, false)
                font_size: 0,        // font size for the buttons
                labels: 'null',        // button labels (cta, counts, null)
                language: 'en',       // which language to use (see LANGUAGES)
                networks: [           // which networks to include (see SHARING NETWORKS)
                    'facebook',
                    'twitter',
                    'pinterest',
                    'email',
                    'print'
                ],
                padding: 10,          // padding within buttons (INTEGER)
                radius: 3,            // the corner radius on each button (INTEGER)
                show_total: false,
                size: 40,             // the size of each button (INTEGER)
                url: window.location.href
            }}
        />

        let metaTitle = this.props.name + " - Making Do Recipes";
        let metaDescription = this.props.steps.replace(/<[^>]+>/g, '').replace(/\r?\n|\r/g," ").replace(/\s{2,}/," ").trim();
        let helmet = "";
        if( this.isModal ) {
            helmet = <Helmet>
                <title>{metaTitle}</title>
                <meta
                    name="description"
                    content={metaDescription}
                />
                <meta property="og:title" content={metaTitle}/>
                <meta property="og:type" content="article"/>
                <meta property="og:url" content={"https://makingdorecipes.com/recipe/" + this.props.id}/>
                <meta propery="og:description" content={metaDescription}/>
                <meta property="twitter:title" content={metaTitle}/>
                <meta propery="twitter:description" content={metaDescription}/>
            </Helmet>
        }
        return <HtmlTag className="ResultListItem">
            {helmet}
            <div className="ResultListItemName">{this.props.name}</div>
            <div className="ResultListItemTags">{this.props.tags}</div>
            <div className="ResultListItemTitle">Ingredients</div>
            <ul className="ResultListItemIngredients">{this.props.ingredients}</ul>
            <div className="ResultListItemTitle">Instructions</div>
            <div className="ResultListItemSteps" dangerouslySetInnerHTML={{__html: this.props.steps}}></div>
            <div className="ResultListItemCredits">{this.props.credits}</div>
            {shareButtons}
            <div className={"ResultListItemButtons " + (this.state.isAdmin ? "" : "hidden")}>
                <Link to={"/add?id=" + this.props.id}><button>Edit</button></Link>
                <button onClick={this.deleteItem}>Delete</button>
            </div>
        </HtmlTag>
    }
}

export default ResultListItem;