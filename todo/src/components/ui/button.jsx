export function Button({ children, onClick, className }) {
  return (
    <button
      onClick={onClick}
      className={`bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-200 transition ${className}`}
    >
      {children}
    </button>
  )
}
