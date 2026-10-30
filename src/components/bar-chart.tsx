// Single-series column chart in plain HTML: thin bars anchored to the baseline with rounded tops,
// the value written above each bar (the brand orange has low contrast on the paper surface, so the
// number never depends on the bar) and a table view with the same data.
export function BarChart({ title, unit, data }: { title: string; unit: string; data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return <figure className="bar-chart">
    <figcaption>{title}</figcaption>
    <div className="bar-chart-plot" role="img" aria-label={`${title}: ${data.map((item) => `${item.label} ${item.value}`).join(", ")}`}>
      {data.map((item) => <div className="bar-chart-col" key={item.label} title={`${item.label}: ${item.value} ${unit}`}>
        <span className="bar-chart-value">{item.value}</span>
        <span className="bar-chart-bar" style={{ height: `${Math.max(item.value ? 4 : 0, item.value / max * 82)}%` }}/>
        <span className="bar-chart-label">{item.label}</span>
      </div>)}
    </div>
    <details className="bar-chart-table"><summary>Ver tabela</summary><table><thead><tr><th>Mês</th><th>{unit}</th></tr></thead><tbody>{data.map((item) => <tr key={item.label}><td>{item.label}</td><td>{item.value}</td></tr>)}</tbody></table></details>
  </figure>;
}
