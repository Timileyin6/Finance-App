import React from "react";
import { PieChart } from "recharts";
import {
    Pie,
    Tooltip,
    Cell,
    ResponsiveContainer,
} from 'recharts';



const colors = [ '#196e59', '#9abdf5', '#ebdaab', '#423b45']

const PieChartComp = ({data}) => { 

    return(
        <div style={{width: '100%', height: 200}}>
            <ResponsiveContainer>
                <PieChart>
                    <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    fill="black"
                    dataKey="amount"
                    label
                    >

                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`}  fill={colors[index %colors.length]}/>
                        ))}
                    </Pie>
                    <Tooltip />
                </PieChart>
            </ResponsiveContainer>
        </div>
    )
    
}

export default PieChartComp;