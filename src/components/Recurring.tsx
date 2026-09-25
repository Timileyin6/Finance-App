import React from "react";
import '../css/recurring.css'

function RecurringBills({bills}){
    return(
    <div className="all-bills">
        <div className="package">
        <p className="billName grey text">{bills.name}</p> 
        <p className="bills text">${bills.value}</p>
    </div> 
    </div>
    )
} 

export default RecurringBills;