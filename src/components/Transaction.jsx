import React from "react";
import '../css/Transaction.css';


function TransactionBar({transaction}){
    return(
        <div className="container2 line">
            <div className="image">
                <img src="#" alt="#" />
            <h4 className="text">{transaction.name}</h4>
            </div> 
            <div>
            <p className="amounts bills text">${transaction.value}</p>
            <p className="date">{transaction.date}</p>
            </div>

        </div>
    )
}

export default TransactionBar;