import React from 'react';

/**
 * Structured guide body format: blocks separated by double newline.
 * First line of each block = type: INTRO | H3 | H4 | P | UL | TABLE
 * Then content lines. TABLE: first line = header (cells with |), then data rows.
 * UL: one list item per line.
 */
export function parseGuideBody(
  body: string,
  styles: Record<string, string>
): React.ReactNode {
  if (!body || !body.trim()) return null;
  const blocks = body.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  const nodes: React.ReactNode[] = [];
  for (const block of blocks) {
    const firstLineEnd = block.indexOf('\n');
    const firstLine = firstLineEnd >= 0 ? block.slice(0, firstLineEnd) : block;
    const rest = firstLineEnd >= 0 ? block.slice(firstLineEnd + 1).trim() : '';
    switch (firstLine) {
      case 'INTRO':
        nodes.push(<p key={nodes.length} className={styles.sectionIntro}>{rest}</p>);
        break;
      case 'H3':
        nodes.push(<h3 key={nodes.length} className={styles.h3}>{rest}</h3>);
        break;
      case 'H4':
        nodes.push(<h4 key={nodes.length} className={styles.h4}>{rest}</h4>);
        break;
      case 'P':
        nodes.push(<p key={nodes.length}>{rest}</p>);
        break;
      case 'UL': {
        const items = rest.split('\n').filter(Boolean);
        nodes.push(
          <ul key={nodes.length} className={styles.list}>
            {items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        );
        break;
      }
      case 'TABLE': {
        const lines = rest.split('\n').filter(Boolean);
        const headerCells = lines[0]?.split('|') ?? [];
        const dataRows = lines.slice(1);
        nodes.push(
          <div key={nodes.length} className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {headerCells.map((cell, i) => (
                    <th key={i}>{cell.trim()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, ri) => (
                  <tr key={ri}>
                    {row.split('|').map((cell, i) => (
                      <td key={i}>{cell.trim()}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        break;
      }
      default:
        nodes.push(<p key={nodes.length}>{block}</p>);
    }
  }
  return <>{nodes}</>;
}
