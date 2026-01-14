// src/components/dashboard/ContentStatsChart.tsx
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

interface ContentStatsChartProps {
  chartData: { name: string; lessons: number; notes: number; mcqs: number; total: number }[];
}

const ContentStatsChart = ({ chartData }: ContentStatsChartProps) => {
  const labels = chartData.map(item => item.name);
  const lessonsData = chartData.map(item => item.lessons);
  const notesData = chartData.map(item => item.notes);
  const mcqsData = chartData.map(item => item.mcqs);

  const data = {
    labels: labels,
    datasets: [
      {
        label: 'Lessons',
        data: lessonsData,
        backgroundColor: '#6366f1',
        borderRadius: 6,
        barThickness: 12,
      },
      {
        label: 'Notes',
        data: notesData,
        backgroundColor: '#8b5cf6',
        borderRadius: 6,
        barThickness: 12,
      },
      {
        label: 'MCQs',
        data: mcqsData,
        backgroundColor: '#10b981',
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
        display: true,
        position: 'top' as const,
        labels: {
          color: '#e5e7eb',
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#fff',
        bodyColor: '#e5e7eb',
        borderColor: '#374151',
        borderWidth: 1,
        padding: 10,
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
          maxRotation: 45,
        },
      },
      y: {
        grid: {
          color: 'rgba(75, 85, 99, 0.2)',
          drawBorder: false,
        },
        ticks: {
          color: '#9ca3af',
          stepSize: 10,
        },
      },
    },
  };

  const totalLessons = lessonsData.reduce((sum, val) => sum + val, 0);
  const totalNotes = notesData.reduce((sum, val) => sum + val, 0);
  const totalMCQs = mcqsData.reduce((sum, val) => sum + val, 0);

  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <div className="p-5 border-b border-background-800">
        <h3 className="text-white font-medium">Content Upload Statistics</h3>
        <p className="text-sm text-success-DEFAULT">By Subject Area</p>
      </div>
      
      <div className="p-5">
        <div className="h-64">
          <Bar data={data} options={options} />
        </div>
      </div>
      
      <div className="p-5 border-t border-background-800 grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="h-8 w-8 bg-primary-500 rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-xs text-white">L</span>
          </div>
          <p className="text-white font-medium">{totalLessons}</p>
          <p className="text-xs text-gray-400">Lessons</p>
        </div>
        
        <div className="text-center">
          <div className="h-8 w-8 bg-secondary-500 rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-xs text-white">N</span>
          </div>
          <p className="text-white font-medium">{totalNotes}</p>
          <p className="text-xs text-gray-400">Notes</p>
        </div>
        
        <div className="text-center">
          <div className="h-8 w-8 bg-accent-500 rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-xs text-white">Q</span>
          </div>
          <p className="text-white font-medium">{totalMCQs}</p>
          <p className="text-xs text-gray-400">MCQs</p>
        </div>
      </div>
    </div>
  );
};

export default ContentStatsChart;
