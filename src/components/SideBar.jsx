import React from "react";
import '../css/SideBar.css'
import { useState } from "react";
import { Link } from "react-router-dom";
import { NavLink } from "react-router-dom";

function MenuBar({toggleSidebar, closeBar}){
    let items = [
       {name : "Overview", icon:"fa-house", path:'/Overview'},
       {name: "Transactions", icon: "fa-arrow-down-up-across-line", path:'/Transactions'},
        {name: "Budgets", icon: "fa-chart-pie", path:'/Budgets'},
        {name: "Pots", icon: "fa-money-check-dollar", path:'/Pots'},
        {name: "Recurring Bills", icon: "fa-money-bill-transfer", path:'/Recurring Bills'},
           ]
    
    const [selectedIndex, setSelectedIndex ] = useState(0)

    return(
        <>
        { closeBar &&
        <div className={closeBar === true ? "container3" : "container3 close"}>
            <div className="mainSide">
            <h1 className="finance">finance</h1>
                <div className="all-items">
                {items.map((item, index) => (<NavLink className={({isActive}) =>
                isActive ? "item sideBarClick" : "item"}
                 key={item} to={item.path} onClick={() => {setSelectedIndex(index)}}>
        <i className={`fa-solid small ${item.icon}`}></i>
        <Link to={`/${item.name}`} className="ourLinks">
        {item.name}
        </Link>
        </NavLink>))}
                </div>
                </div>
            <footer className="minimize" onClick={toggleSidebar}>
            <i class="fa-solid fa-backward small"></i>
                Minimize Menu</footer>
        </div>}
        { !closeBar && 
        <div className="container7">
            <div>
                        <h1 className="financ">finance</h1>
                        {items.map((item, index) => 
                        <NavLink className={ ({isActive}) => isActive ?
                            `fa-solid medium sideBarClick ${item.icon}`:
                            `fa-solid medium ${item.icon}`
                        } key={item} to={item.path} onClick={()=>{setSelectedIndex(index)}}></NavLink>)}
                        </div>
                        <footer className="maximize" onClick={toggleSidebar}>
            <i class="fa-solid fa-arrow-right-to-bracket medium"></i>
                   </footer>
        </div>
        }
        </>
    )
}

export default MenuBar;