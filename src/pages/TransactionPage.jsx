import React from "react";
import TransactionBar from "../components/Transaction";
import PieChartComp from "../components/PieChartComponent";
import BudgetBar from "../components/Budgets";
import '../css/TransactionPage.css'

function TransactionPageLayout() {

    const transaction = [
        {id: 1,name: "Emma Richardson", value: 75.50, date: "19 Aug 2024"},
        {id: 2,name: "Savory Bites Bistro", value: -55.50, date: "19 Aug 2024"},
        {id: 3,name: "Daniel Carter", value: -42.30, date: "18 Aug 2024"},
        {id: 4,name: "Sun Park", value: 120.00, date: "17 Aug 2024"},
        {id: 5,name: "Urban Services Hub", value: -65.00, date: "17 Aug 2024"},
        {id: 6,name: "Urban Services Hub", value: -65.00, date: "17 Aug 2024"},
        {id: 7,name: "Urban Services Hub", value: -65.00, date: "17 Aug 2024"},
        {id: 8,name: "Urban Services Hub", value: -65.00, date: "17 Aug 2024"},
        {id: 9,name: "Urban Services Hub", value: -65.00, date: "17 Aug 2024"},
        {id: 10,name: "Urban Services Hub", value: -65.00, date: "17 Aug 2024"},
        {id: 11,name: "Urban Services Hub", value: -65.00, date: "17 Aug 2024"},
        {id: 12,name: "Urban Services Hub", value: -65.00, date: "17 Aug 2024"},
        {id: 13,name: "Urban Services Hub", value: -65.00, date: "17 Aug 2024"},
        {id: 14,name: "Urban Services Hub", value: -65.00, date: "17 Aug 2024"},
        {id: 15,name: "Urban Services Hub", value: -65.00, date: "17 Aug 2024"},
        {id: 16,name: "Urban Services Hub", value: -65.00, date: "17 Aug 2024"},
        {id: 17,name: "Urban Services Hub", value: -65.00, date: "17 Aug 2024"},
        {id: 18,name: "Urban Services Hub", value: -65.00, date: "17 Aug 2024"},
        {id: 19,name: "Urban Services Hub", value: -65.00, date: "17 Aug 2024"},
        {id: 20,name: "Urban Services Hub", value: -65.00, date: "17 Aug 2024"},
    ];

    const transactionSent = [
        {name: "Personal transfers", amount: 75.50},
        {name: "Food", amount: 55.50},
        {name: "Bills", amount: 42.30},
        {name: "Giving", amount: 120.00},
        {name: "Miscellenous", amount: 65.00},
    ];

    const transactionReceived = [
        {name: "Personal transfers", amount: 75.50},
        {name: "Main Salary", amount: 55.50},
        {name: "Side Business", amount: 42.30},
    ];
        
    return(
        <div>
        <div className="transContainer hide-scrollbar">
            <h1 className="transHeader">Transactions</h1>
            <div className="transMain">
            <div className="transMetrics">
                <div className="transact build">
                    <h4>Make Transaction</h4>
                    <i class="fa-solid fa-plus"></i>
                </div>
                <div className="transMetric build">
                    <p className="grey">Total Received</p>
                    <h2>$50000</h2>
                </div>
                <div className="transMetric build">
                    <p className="grey">Total Spent</p>
                    <h2>$50000</h2>
                </div>
            </div>

            <div className="bigColumns">
                <div className="transColumn build hide-scrollbar">
                    <div className="topBar">
                    <div className="searchBar">
                    <input placeholder="Search Transactions" className="searchInput" />
                    <i class="fa-solid fa-magnifying-glass small"></i>
                    </div>
                    <i class="fa-solid fa-file-invoice medium"></i>
                    <i class="fa-solid fa-filter medium"></i>
                    </div>
                    {transaction.map(transaction => <TransactionBar transaction={transaction} key={transaction.id} />)}
                </div>
                <div className="budgetColumn">
                <div className="transBudget1 build">
                    <PieChartComp data={transactionReceived}/>
                    <div className="section1">
                    {transactionReceived.map(transactionReceived => <BudgetBar key={transactionReceived} budget={transactionReceived} className ="guy"/>)}
                </div>
                </div>

                <div className="transBudget1 build">
                    <PieChartComp data={transactionSent}/>
                    <div className="section1">
                    {transactionSent.map(transactionSent => <BudgetBar key={transactionSent} budget={transactionSent} />)}
                </div>
                </div>

                </div>
                
            </div>




        </div>
        </div>
        </div>
    )
}

export default TransactionPageLayout;