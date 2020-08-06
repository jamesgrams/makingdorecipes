import React from 'react';
import './Modal.css';
import {Portal} from 'react-portal';
import {
    Link
} from "react-router-dom";

class Modal extends React.Component {

    /**
     * Constructor.
     * @param {Array} props - The props to pass in on initialization.
     */
    constructor(props) {
        super(props);
        this.state = {};
    }

    /**
     * Render the element.
     */
    render() {
        let mask = <Link to="/" onClick={this.props.onclick}>
            <div className="Mask"></div>
        </Link>

        return <Portal className="Portal">{mask}<div className={"ModalContent " + (this.props.className || "")}>{this.props.content}</div></Portal>;
    }
}

export default Modal;