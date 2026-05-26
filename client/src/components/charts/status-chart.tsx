import { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
import { STATUS_COLORS } from "@/lib/eco-palette";

Chart.register(...registerables);

interface StatusChartProps {
  stats: {
    active: number;
    expiring: number;
    expired: number;
  };
}

export default function StatusChart({ stats }: StatusChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    chartInstance.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Ativas", "A Vencer", "Vencidas"],
        datasets: [
          {
            data: [stats.active, stats.expiring, stats.expired],
            backgroundColor: [
              STATUS_COLORS.active,    // teal
              STATUS_COLORS.expiring,  // laranja
              STATUS_COLORS.expired,   // laranja escuro
            ],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              padding: 20,
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              label: function(context: any) {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [stats]);

  return <canvas ref={chartRef} />;
}
