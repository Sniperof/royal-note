// FilterBar.jsx — Horizontal filter row
const FilterBar = ({ activeCategory, setActiveCategory, activeSort, setActiveSort }) => {
  const categories = ['All', 'Floral', 'Oud & Oriental', 'Citrus', 'Woody', 'Fresh', 'Aquatic'];
  const sorts = ['Featured', 'Price: Low–High', 'Price: High–Low', 'Newest'];

  return (
    <div style={filterStyles.bar}>
      <div style={filterStyles.tags}>
        {categories.map(cat => (
          <button
            key={cat}
            style={{
              ...filterStyles.tag,
              ...(activeCategory === cat ? filterStyles.tagActive : {}),
            }}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      <div style={filterStyles.right}>
        <span style={filterStyles.sortLabel}>Sort</span>
        <select
          style={filterStyles.select}
          value={activeSort}
          onChange={e => setActiveSort(e.target.value)}
        >
          {sorts.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );
};

const filterStyles = {
  bar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 40px', borderBottom: '1px solid #EEEEEE', background: '#fff', flexWrap: 'wrap' },
  tags: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tag: { fontFamily: 'Outfit, sans-serif', fontSize: 12, fontWeight: 500, letterSpacing: '0.03em', padding: '6px 14px', borderRadius: 6, border: '1.5px solid #EEEEEE', background: '#fff', color: '#141413', cursor: 'pointer', transition: 'all 0.15s ease' },
  tagActive: { background: '#141413', color: '#fff', borderColor: '#141413' },
  right: { display: 'flex', alignItems: 'center', gap: 8 },
  sortLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#949494' },
  select: { fontFamily: 'Outfit, sans-serif', fontSize: 13, color: '#141413', background: '#FAF9F5', border: '1.5px solid #EEEEEE', borderRadius: 6, padding: '6px 28px 6px 10px', outline: 'none', appearance: 'none', cursor: 'pointer' },
};

Object.assign(window, { FilterBar });
