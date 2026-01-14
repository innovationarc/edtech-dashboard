// src/components/dashboard/SalesChart.tsx
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface SalesChartProps {
  chartData: any[]; // Assuming Transaction[] from paymentService
}

const SalesChart = ({ chartData }: SalesChartProps) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Aggregate sales data by month
  const monthlySales = months.map((_, monthIndex) => {
    const salesForMonth = chartData.filter(transaction => {
      const transactionMonth = transaction.createdAt.getMonth();
      const transactionYear = transaction.createdAt.getFullYear();
      const currentYear = new Date().getFullYear(); // Assuming current year for simplicity
      return transactionMonth === monthIndex && transactionYear === currentYear;
    }).reduce((sum, transaction) => sum + transaction.amount, 0);
    return salesForMonth;
  });

  const data = {
    labels: months,
    datasets: [
      {
        label: 'Sales',
        data: monthlySales,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#fff',
        bodyColor: '#e5e7eb',
        borderColor: '#374151',
        borderWidth: 1,
        padding: 10,
        displayColors: false,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          color: '#9ca3af',
        },
      },
      y: {
        grid: {
          color: 'rgba(75, 85, 99, 0.2)',
          drawBorder: false,
        },
        ticks: {
          color: '#9ca3af',
          stepSize: 100,
        },
      },
    },
    elements: {
      point: {
        radius: 0,
        hoverRadius: 6,
        hitRadius: 6,
        hoverBackgroundColor: '#8b5cf6',
      },
    },
  };

  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <div className="p-5 border-b border-background-800 flex justify-between items-center">
        <div>
          <h3 className="text-white font-medium">Sales Overview</h3>
          <p className="text-sm text-success-DEFAULT">(+23%) than last year</p>
        </div>
      </div>
      
      <div className="p-5">
        <div className="h-72">
          <Line data={data} options={options} />
        </div>
      </div>
    </div>
  );
};

export default SalesChart;
