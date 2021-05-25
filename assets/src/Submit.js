import React from 'react';
import './Submit.css';
import TagsInput from 'react-tagsinput';
import { Editor } from '@tinymce/tinymce-react';
import Autosuggest from 'react-autosuggest'
import Helmet from 'react-helmet'

const COULD_NOT_SUBMIT = "An error ocurred. Please try again later.";

class Submit extends React.Component {

    /**
     * Constructor.
     * @param {Array} props - The props to pass in on initialization.
     */
    constructor(props) {
        super(props);

        this.initialState = {
            "id": new URLSearchParams(window.location.search).get("id") || "", // If present, assume admin
            "name": "",
            "tags": [],
            "steps": "",
            "ingredients": [{
                "option": [{
                    "name": "",
                    "quantity": "",
                    "allergen": []
                }]
            }],
            "credit": {
                "name": "",
                "link" : ""
            },
            "submitting": false,
            "submitted": false,
            "submitMessage": "",
            "optionSuggestions": []
        };
        this.state = JSON.parse(JSON.stringify(this.initialState));

        this.autocompleteTagInput = this.props.autocompleteTagInput;
        this.setOverrideAddMaskWarning = this.props.setOverrideAddMaskWarning;
        this.formRef = React.createRef();

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.allowAddMaskOrNot();
    }

    /**
     * Called upon component mount.
     * We'll fetch the recipe if determined necessary.
     */
    componentDidMount() {
        if( this.state.id ) {
            fetch("/recipe?id=" + this.state.id + "&all=true").then(
                response => response.json().then( data => {
                    if( !data.recipes.length ) {
                        this.setStateAndMaskAlert({"id": ""});
                    }
                    else {
                        let recipe = data.recipes[0];
                        for( let i of recipe.ingredient ) {
                            for( let o of i.option ) {
                                delete o.name_suggestable;
                                for( let a of o.allergen ) {
                                    delete a.name_suggestable;
                                }
                            }
                        }
                        this.setStateAndMaskAlert({
                            "name": recipe.name,
                            "tags": recipe.tag.map(el => el.name),
                            "steps": recipe.steps,
                            "ingredients": recipe.ingredient,
                            "credit": recipe.credit ? recipe.credit : this.state.credit
                        });
                    }
                })
                .catch(err => {
                    this.setStateAndMaskAlert({"id": ""});
                })
            ).catch(err => {
                this.setStateAndMaskAlert({"id": ""});
            });
        }
    }

    /**
     * The modal is being removed.
     */
    componentWillUnmount() {
        try {
            window.tinymce.remove();
        }
        catch(err) {
            console.log(err);
        }
    }

    /**
     * Set whether mask should allow to exit without warning or not.
     * We exit without warning if the state is unchanged or we have submitted already.
     */
    allowAddMaskOrNot() {
        if( this.state.submitted || JSON.stringify(this.state) === JSON.stringify(this.initialState)) {
            this.setOverrideAddMaskWarning(true);
        }
        else {
            this.setOverrideAddMaskWarning(false);
        }
    }

    /**
     * Set the state and if mask is allowed to exit without warning.
     * @param {Object} state - The state to set.
     * @param {Function} callback - The callback to call.
     */
    setStateAndMaskAlert( state, callback ) {
        this.setState( state, () => {
            this.allowAddMaskOrNot();
            if(callback) callback();
        } );
    }

    /**
     * Handle a change to the form. Note that this is for values and not really what is displayed on the page.
     * @param {Event} event - The event. 
     */
    handleChange(event) {

        let name = event.target.name;
        if( !name ) return;
        let value = event.target.value;
        
        if( name === "credit-name") {
            let credit = this.state.credit;
            credit.name = value;
            this.setStateAndMaskAlert({ credit: credit });
        }
        else if( name === "credit-link" ) {
            let credit = this.state.credit;
            credit.link = value;
            this.setStateAndMaskAlert({ credit: credit });
        }
        else if( name.match(/^option-/) ) {
            let match = name.match(/^option-([^-]+)-(\d+)-(\d+)/);
            let ingredients = this.state.ingredients;
            ingredients[match[2]].option[match[3]][match[1]] = value;
            this.setStateAndMaskAlert({ingredients:ingredients});
        }
        else {
            // Set State redraws components as necessary
            this.setStateAndMaskAlert({ [name]: value });
        }
    }

    /**
     * Handle the form submission.
     * @param {Event} event - The event.
     */
    handleSubmit(event) {
        event.preventDefault();
        if( this.state.submitting ) return;
        if( !this.formRef.current.reportValidity() ) return;
        if( !window.confirm("Are you ready to submit?") ) return;
        this.setStateAndMaskAlert({"submitting": true}, () => {

            // notice the switch to singular here
            let submit = {
                "name": this.state.name,
                "tag": this.state.tags.map(el => {return{"name": el}}),
                "steps": this.state.steps,
                "ingredient": this.state.ingredients,
                "approved": this.state.id ? true : false
            };
            if( this.state.credit.name ) {
                submit.credit = this.state.credit;
            }
            if( this.state.id ) {
                submit.id = this.state.id;
            }
            fetch("/recipe", { 
                method: 'PUT', 
                body: JSON.stringify(submit), 
                headers: {'Content-Type': 'application/json'} 
            }).then(
                response => response.json().then( data => {
                    if( data.status === "success" ) {
                        let submitMessage =  "Thank you, your recipe has been successfully submitted. It will be available once it is approved.";
                        if( this.state.id ) {
                            submitMessage = "Thank you, the recipe is now available.";
                        }

                        this.setStateAndMaskAlert({
                            "submitting": false,
                            "submitted": true,
                            submitMessage: submitMessage
                        });
                    }
                    else {
                        this.setStateAndMaskAlert({
                            "submitting": false,
                            submitMessage: COULD_NOT_SUBMIT
                        });
                    }
                })
                .catch(err => {
                    this.setStateAndMaskAlert({
                        "submitting": false,
                        submitMessage: COULD_NOT_SUBMIT
                    });
                })
            ).catch(err => {
                this.setStateAndMaskAlert({
                    "submitting": false,
                    submitMessage: COULD_NOT_SUBMIT
                });
            });

        });
    }

    /**
     * Render the element.
     */
    render() {

        // Map the ingredients into fields
        this.ingredients = this.state.ingredients.map( (ingredient, index) => {

            let options = ingredient.option.map( (option, index2) => {
                let allergens = option.allergen.map( (allergen) => {
                    return allergen.name
                } );
                if( !allergens ) allergens = [];

                // The allergens input is a tags input
                let allergensInput = <TagsInput
                    renderInput={({addTag, ...props}) => this.autocompleteTagInput({addTag, ...props}, "allergen")}
                    inputProps={{
                        className: "react-tagsinput-input SubmitAllergens",
                        placeholder: "Allergens",
                        "aria-label": "Allergens",
                    }}
                    onlyUnique="true"
                    name={"option-allergens-" + index + "-" + index2}
                    value={allergens}
                    addOnBlur={true}
                    onChange={(allergens) => {
                        let ingredients = this.state.ingredients;
                        ingredients[index].option[index2].allergen = allergens.map((el) => {return {"name": el}});
                        this.setStateAndMaskAlert({ingredients: ingredients})
                    }} />

                // There will be three boxes, two on the first row, and one on the second
                // the first will be for quantity and name, the second row for allergens
                let required = index === 0 && index2 === 0;
                let canEnter = true;
                return <div key={index2} className="SubmitOption">
                    <div className="SubmitOptionRow">
                        <input required={required} className="SubmitQuantity" aria-label="Quantity" type="text" name={"option-quantity-" + index + "-" + index2} value={option.quantity} placeholder="Quantity" onChange={this.handleChange}/>
                        <Autosuggest
                            suggestions={this.state.optionSuggestions}
                            shouldRenderSuggestions={(value) => value && value.trim().length > 0}
                            onSuggestionsFetchRequested={({value}) => {
                                fetch( "/option?search=" + value ).then(
                                    (response) => response.json().then(
                                        (json) => {
                                            this.setStateAndMaskAlert({optionSuggestions: json.options})
                                        }
                                    )
                                )
                            }}
                            onSuggestionsClearRequested={() => { this.setStateAndMaskAlert({ "optionSuggestions": [] } ) }}
                            getSuggestionValue={(suggestion) => suggestion}
                            renderSuggestion={(suggestion) => <span>{suggestion}</span>}
                            inputProps={{
                                className: "SubmitName",
                                "aria-label": "Ingredient",
                                name: "option-name-" + index + "-" + index2,
                                type: "text",
                                value: option.name,
                                onChange: this.handleChange,
                                required: required,
                                placeholder: "Ingredient",
                                onKeyDown: (event) => {
                                    if( !canEnter && event.keyCode === 13 ) { // enter
                                        event.preventDefault();
                                    }
                                }
                            }}
                            onSuggestionHighlighted={({suggestion}) => {
                                if( suggestion ) canEnter = false;
                                else canEnter = true;
                            }}
                            onSuggestionSelected={(e, {suggestion}) => {
                                // fetch allergens when the user selects an option
                                let ingredients = this.state.ingredients;
                                ingredients[index].option[index2].name = suggestion;
                                this.setStateAndMaskAlert({ingredients: ingredients}, () => {
                                    if( !this.state.ingredients[index].option[index2].allergen.length ) {
                                        fetch( "/option-allergen?option=" + suggestion ).then(
                                            (response) => response.json().then(
                                                (json) => {
                                                    if( !this.state.ingredients[index].option[index2].allergen.length ) {
                                                        ingredients[index].option[index2].allergen = json.allergens.map(el => {return{"name":el}});
                                                        this.setStateAndMaskAlert({ingredients: ingredients})
                                                    }
                                                }
                                            )
                                        )
                                    }
                                } );
                                setTimeout(()=>document.activeElement.blur(),25);
                            }}
                            >
                        </Autosuggest>
                    </div>
                    <div className="SubmitOptionRow">
                        {allergensInput}
                    </div>
                    <button type="button" aria-label="Remove Substitute" className={"SubmitRemove " + (this.state.ingredients[index].option.length <= 1 ? "hidden" : "")} onClick={(e) => {
                        e.preventDefault();
                        let ingredients = this.state.ingredients;
                        ingredients[index].option.splice(index2, 1);
                        this.setStateAndMaskAlert({ingredients:ingredients})
                    }}>x</button>
                </div>
            } );
            return <div key={index} className="SubmitIngredient">
                {options}
                <button type="button" className="SubmitAddOption" onClick={(e) => {
                    e.preventDefault();
                    let currentIngredients = this.state.ingredients;
                    currentIngredients[index].option.push({
                        "name": "",
                        "quantity": "",
                        "allergen": []
                    });
                    this.setStateAndMaskAlert({ingredients:currentIngredients});
                }}>
                    Add Substitute
                </button>
                <button type="button" aria-label="Remove Ingredient" className={"SubmitRemove " + (this.state.ingredients.length <= 1 ? "hidden" : "")} onClick={(e) => {
                    e.preventDefault();
                    let ingredients = this.state.ingredients;
                    ingredients.splice(index, 1);
                    this.setStateAndMaskAlert({ingredients:ingredients})
                }}>x</button>
            </div>

        } );

        let metaTitle = "Add Recipe - Making Do Recipes"; // These should match what we set initially in index.html
        let metaDescription = "Submit a recipe to Making Do Recipes for approval, so others with allergies can enjoy your creations.";

        return <form className="Submit" ref={this.formRef}>
            <Helmet>
                <title>{metaTitle}</title>
                <meta name="description" content={metaDescription} />
                <meta property="og:title" content={metaTitle}/>
                <meta property="og:url" content="https://makingdorecipes.com/add"/>
                <meta propery="og:description" content={metaDescription}/>
                <meta property="twitter:title" content={metaTitle}/>
                <meta propery="twitter:description" content={metaDescription}/>
            </Helmet>
            <div className="SubmitTitle">Add a Recipe</div>
            <label title="The name of the recipe">
                <span className="SubmitLabelText">Name:</span>
                <input
                    required={true}
                    name="name"
                    type="text"
                    value={this.state.name}
                    onChange={this.handleChange} />
            </label>
            <label title="Tags that can be used to easily find the recipe">
                <span className="SearchLabelText">Tags:</span>
                <TagsInput
                    renderInput={({addTag, ...props}) => this.autocompleteTagInput({addTag, ...props}, "tag")}
                    inputProps={{className: "react-tagsinput-input",placeholder: "Add tag"}}
                    onlyUnique="true"
                    name="tags"
                    value={this.state.tags}
                    addOnBlur={true}
                    onChange={(tags) => {
                        this.setStateAndMaskAlert({tags: tags})
                    }} />
            </label>
            <div className="SubmitSectionTitle">Ingredients</div>
            {this.ingredients}
            <button type="button" className="SubmitAddIngredient" onClick={(e) => {
                    e.preventDefault();
                    let currentIngredients = this.state.ingredients;
                    currentIngredients.push({
                        "option": [{
                            "name": "",
                            "quantity": "",
                            "allergen": []
                        }]
                    });
                    this.setStateAndMaskAlert({ingredients:currentIngredients});
                }}>
                    Add Ingredient
            </button>
            <div className="SubmitSectionTitle">Instructions</div>
            <Editor
                value={this.state.steps}
                onEditorChange={(content) => {this.setStateAndMaskAlert({steps:content})}}
                plugins="lists image imagetools"
                toolbar="undo redo | styleselect | bold italic | outdent indent | numlist bullist | image"
                init={{
                    valid_elements: "ul,ol,li,p,pre,blockquote,div,span,br,sub,em,strong,sup,code,h1,h2,h3,h4,h5,h6,img[*]",
                    font_formats: "Merriweather=merriweather",
                    content_style: "body {font-family:Merriweather;font-size:16px}",
                    relative_urls : true,
                    remove_script_host : true,
                    convert_urls : true,
                    images_upload_url: "/upload"
                }}
                apiKey={process.env.REACT_APP_TINY_KEY}
            >
            </Editor>
            <div className="SubmitSectionTitle">Credit</div>
            <div className="SubmitRow">
                <label title="The person to credit the recipe to">
                    <span className="SubmitLabelText">Name:</span>
                    <input
                        required={this.state.credit.link}
                        name="credit-name"
                        type="text"
                        value={this.state.credit.name}
                        placeholder={this.state.credit.link ? "" : "Optional"}
                        onChange={this.handleChange} />
                </label>
                <label title="The website or email to credit the recipe to">
                    <span className="SubmitLabelText">Website/Email:</span>
                    <input
                        name="credit-link"
                        type="text"
                        value={this.state.credit.link}
                        placeholder="Optional"
                        onChange={this.handleChange} />
                </label>
            </div>
            <div className={"SubmitMessage " + (this.state.submitMessage ? "" : "hidden") + " " + (this.state.submitted ? "" : "SubmitMessageError")}>{this.state.submitMessage}</div>
            <button type="submit" className={"SubmitSubmit " + (this.state.submitted ? "hidden" : "")} disabled={this.state.submitting ? "disabled" : ""} onClick={this.handleSubmit}>Submit</button><div className="SubmitClear"></div>
        </form>
    }
}

export default Submit;