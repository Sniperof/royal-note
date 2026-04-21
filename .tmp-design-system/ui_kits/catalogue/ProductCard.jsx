// ProductCard.jsx — Royal Note product card
const ProductCard = ({ product, onClick }) => {
  const [hovered, setHovered] = React.useState(false);

  const badgeColor = product.badge === 'New' ? '#4D49BE' : '#141413';

  return (
    <div
      style={{
        ...cardStyles.card,
        boxShadow: hovered
          ? '0 4px 16px rgba(0,0,0,0.10)'
          : '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick && onClick(product)}
    >
      <div style={cardStyles.imgWrap}>
        <ProductBottle color={product.bottleColor} />
        {product.badge && (
          <span style={{ ...cardStyles.badge, background: badgeColor }}>{product.badge}</span>
        )}
      </div>
      <div style={cardStyles.body}>
        <div style={cardStyles.brand}>{product.brand}</div>
        <div style={cardStyles.name}>{product.name}</div>
        <div style={cardStyles.meta}>{product.size} · {product.variants} variants · MOQ {product.moq}</div>
        <div style={cardStyles.price}>From {product.price} / unit</div>
      </div>
    </div>
  );
};

const ProductBottle = ({ color = '#c8c3bb' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
    <div style={{ width: 18, height: 12, background: color, borderRadius: '3px 3px 0 0', opacity: 0.7 }}></div>
    <div style={{ width: 32, height: 62, background: color, borderRadius: 4 }}></div>
  </div>
);

const cardStyles = {
  card: { background: '#fff', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0 },
  imgWrap: { width: '100%', height: 180, background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  badge: { position: 'absolute', top: 10, left: 10, color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 999 },
  body: { padding: '14px 16px 16px' },
  brand: { fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#949494', marginBottom: 5 },
  name: { fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600, color: '#141413', lineHeight: 1.3, marginBottom: 5 },
  meta: { fontSize: 12, color: '#949494', marginBottom: 10 },
  price: { fontSize: 14, fontWeight: 600, color: '#141413' },
};

Object.assign(window, { ProductCard, ProductBottle });
