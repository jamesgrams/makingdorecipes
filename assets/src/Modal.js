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
     * The modal is being removed.
     */
    componentWillUnmount() {
        document.body.classList.remove("modal-open");
        let scrollY = document.body.style.top;
        document.body.style.top = '';
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }

    /**
     * The modal is being added.
     */
    componentDidMount() {
        if( !document.body.classList.contains("modal-open") ) {
            document.body.style.top = `-${window.scrollY}px`;
            document.body.classList.add("modal-open");
        }
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