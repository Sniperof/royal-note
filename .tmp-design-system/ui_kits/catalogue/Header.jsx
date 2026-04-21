// Header.jsx — Royal Note top navigation
const Header = ({ onSearch, searchValue, currentPage, setPage }) => {
  const Sparkle = ({ size = 20, color = '#141413' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <line x1="12" y1="2" x2="12" y2="22" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="2" y1="12" x2="22" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );

  return (
    <header style={headerStyles.nav}>
      <div style={headerStyles.left}>
        <span style={headerStyles.navLink} onClick={() => setPage('catalogue')}>Catalogue</span>
        <span style={headerStyles.navLink} onClick={() => setPage('brands')}>Brands</span>
        <span style={headerStyles.navLink}>About</span>
      </div>

      <div style={headerStyles.logoWrap} onClick={() => setPage('catalogue')}>
        <Sparkle size={22} />
        <span style={headerStyles.wordmark}>Royal Note</span>
      </div>

      <div style={headerStyles.right}>
        <div style={headerStyles.searchBar}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#949494" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            style={headerStyles.searchInput}
            placeholder="Search fragrances…"
            value={searchValue}
            onChange={e => onSearch(e.target.value)}
          />
        </div>
        <button style={{...headerStyles.btn, ...headerStyles.btnGhost}}>Staff Login</button>
        <button style={{...headerStyles.btn, ...headerStyles.btnDark}} onClick={() => setPage('quote')}>Request Quote</button>
      </div>
    </header>
  );
};

const headerStyles = {
  nav: { height: 64, background: '#fff', borderBottom: '1px solid #EEEEEE', display: 'flex', alignItems: 'center', padding: '0 40px', gap: 24, position: 'sticky', top: 0, zIndex: 100 },
  left: { display: 'flex', gap: 24, alignItems: 'center', flex: 1 },
  navLink: { fontSize: 12, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#141413', cursor: 'pointer', whiteSpace: 'nowrap' },
  logoWrap: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1, justifyContent: 'center' },
  wordmark: { fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, color: '#141413', letterSpacing: '-0.02em' },
  right: { display: 'flex', gap: 12, alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  searchBar: { background: '#FAF9F5', border: '1.5px solid #EEEEEE', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', width: 220 },
  searchInput: { border: 'none', background: 'transparent', fontFamily: 'Outfit, sans-serif', fontSize: 13, color: '#141413', outline: 'none', width: '100%' },
  btn: { fontFamily: 'Outfit, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 16px', borderRadius: 8, cursor: 'pointer' },
  btnGhost: { background: 'transparent', border: '1.5px solid #EEEEEE', color: '#141413' },
  btnDark: { background: '#141413', border: 'none', color: '#fff' },
};

Object.assign(window, { Header });
