// src/components/dashboard/ActiveUsersChart.tsx
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip
);

interface ActiveUsersChartProps {
  chartData: number[]; // Array of user counts for each day (e.g., last 7 days)
}

const ActiveUsersChart = ({ chartData }: ActiveUsersChartProps) => {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // Assuming 7 days

  const data = {
    labels: labels,
    datasets: [
      {
        data: chartData,
        backgroundColor: '#6366f1',
        borderRadius: 6,
        barThickness: 12,
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
  };

  const totalUsers = chartData.reduce((sum, val) => sum + val, 0);
  // const averageUsers = chartData.length > 0 ? Math.round(totalUsers / chartData.length) : 0; // Not used in display

  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <div className="p-5 border-b border-background-800">
        <h3 className="text-white font-medium">Active Users</h3>
        <p className="text-sm text-success-DEFAULT">(+23%) than last week</p>
      </div>
      
      <div className="p-5">
        <div className="h-52">
          <Bar data={data} options={options} />
        </div>
      </div>
      
      <div className="p-5 border-t border-background-800 grid grid-cols-4 gap-4">
        <div className="text-center">
          <div className="h-8 w-8 bg-primary-500 rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-xs text-white">U</span>
          </div>
          <p className="text-white font-medium">{totalUsers}</p>
          <p className="text-xs text-gray-400">Users</p>
        </div>
        
        <div className="text-center">
          <div className="h-8 w-8 bg-secondary-500 rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-xs text-white">C</span>
          </div>
          <p className="text-white font-medium">2.42m</p>
          <p className="text-xs text-gray-400">Clicks</p>
        </div>
        
        <div className="text-center">
          <div className="h-8 w-8 bg-accent-500 rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-xs text-white">S</span>
          </div>
          <p className="text-white font-medium">2,400$</p>
          <p className="text-xs text-gray-400">Sales</p>
        </div>
        
        <div className="text-center">
          <div className="h-8 w-8 bg-error-DEFAULT rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-xs text-white">I</span>
          </div>
          <p className="text-white font-medium">320</p>
          <p className="text-xs text-gray-400">Items</p>
        </div>
      </div>
    </div>
  );
};

export default ActiveUsersChart;
