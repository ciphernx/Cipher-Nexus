import React from 'react';

interface Column<T> {
  key: keyof T | 'actions';
  title: string;
  render?: (value: any, item: T) => React.ReactNode;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
}

export function Table<T extends { id: string | number }>({
  data,
  columns,
  onRowClick
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key as string}
                className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item) => (
            <tr
              key={item.id}
              onClick={() => onRowClick?.(item)}
              className="hover:bg-gray-50 cursor-pointer"
            >
              {columns.map((column) => (
                <td
                  key={column.key as string}
                  className="px-6 py-4 whitespace-nowrap"
                >
                  {column.render
                    ? column.render(item[column.key], item)
                    : String(item[column.key] || '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
