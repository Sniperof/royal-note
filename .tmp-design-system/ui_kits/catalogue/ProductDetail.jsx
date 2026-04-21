// ProductDetail.jsx — Product detail slide-over panel
const ProductDetail = ({ product, onClose, onQuote }) => {
  if (!product) return null;

  const variants = [
    { size: '30ml', price: product.price, stock: 'In Stock' },
    { size: '50ml', price: `$${(parseFloat(product.price.replace('$','')) * 1.5).toFixed(2)}`, stock: 'In Stock' },
    { size: '100ml', price: `$${(parseFloat(product.price.replace('$','')) * 2.4).toFixed(2)}`, stock: 'Low Stock' },
  ];

  const [selectedVariant, setSelectedVariant] = React.useState(0);

  return (
    <div style={detailStyles.overlay} onClick={onClose}>
      <div style={detailStyles.panel} onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button style={detailStyles.close} onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#141413" strokeWidth="1.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>

        {/* Image */}
        <div style={detailStyles.imgWrap}>
          <ProductBottle color={product.bottleColor} />
          {product.badge && (
            <span style={{ ...detailStyles.badge, background: product.badge === 'New' ? '#4D49BE' : '#141413' }}>{product.badge}</span>
          )}
        </div>

        {/* Info */}
        <div style={detailStyles.body}>
          <div style={detailStyles.brand}>{product.brand}</div>
          <div style={detailStyles.name}>{product.name}</div>
          <div style={detailStyles.category}>{product.category}</div>

          <p style={detailStyles.description}>{product.description}</p>

          {/* Variants */}
          <div style={detailStyles.sectionLabel}>Select Size</div>
          <div style={detailStyles.variants}>
            {variants.map((v, i) => (
              <div
                key={i}
                style={{ ...detailStyles.variant, ...(selectedVariant === i ? detailStyles.variantActive : {}) }}
                onClick={() => setSelectedVariant(i)}
              >
                <div style={detailStyles.variantSize}>{v.size}</div>
                <div style={detailStyles.variantPrice}>{v.price}</div>
                <div style={{ ...detailStyles.variantStock, color: v.stock === 'In Stock' ? '#949494' : '#C0392B' }}>{v.stock}</div>
              </div>
            ))}
          </div>

          <div style={detailStyles.moqRow}>
            <span style={detailStyles.moqLabel}>Minimum Order Qty</span>
            <span style={detailStyles.moqValue}>{product.moq} units</span>
          </div>

          {/* CTAs */}
          <div style={detailStyles.ctas}>
            <button style={detailStyles.btnPrimary} onClick={() => onQuote(product)}>Request a Quote</button>
            <button style={detailStyles.btnWhatsApp}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp Us
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const detailStyles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' },
  panel: { width: 420, background: '#fff', height: '100%', overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' },
  close: { position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 6, zIndex: 10 },
  imgWrap: { width: '100%', height: 280, background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 },
  badge: { position: 'absolute', top: 16, left: 16, color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: 999 },
  body: { padding: '24px 28px 40px', flex: 1 },
  brand: { fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#949494', marginBottom: 6 },
  name: { fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 700, color: '#141413', lineHeight: 1.2, marginBottom: 6 },
  category: { fontSize: 13, color: '#949494', marginBottom: 16 },
  description: { fontSize: 14, color: '#525252', lineHeight: 1.6, marginBottom: 24 },
  sectionLabel: { fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#949494', marginBottom: 10 },
  variants: { display: 'flex', gap: 10, marginBottom: 20 },
  variant: { flex: 1, border: '1.5px solid #EEEEEE', borderRadius: 10, padding: '12px 10px', cursor: 'pointer', transition: 'all 0.15s ease', textAlign: 'center' },
  variantActive: { border: '1.5px solid #141413', background: '#FAF9F5' },
  variantSize: { fontSize: 14, fontWeight: 600, color: '#141413', marginBottom: 3 },
  variantPrice: { fontSize: 13, color: '#141413', marginBottom: 2 },
  variantStock: { fontSize: 11, color: '#949494' },
  moqRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid #EEEEEE', borderBottom: '1px solid #EEEEEE', marginBottom: 24 },
  moqLabel: { fontSize: 12, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#949494' },
  moqValue: { fontSize: 14, fontWeight: 600, color: '#141413' },
  ctas: { display: 'flex', flexDirection: 'column', gap: 10 },
  btnPrimary: { width: '100%', background: '#141413', color: '#fff', border: 'none', borderRadius: 8, padding: '14px 0', fontFamily: 'Outfit, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' },
  btnWhatsApp: { width: '100%', background: '#25D366', color: '#fff', border: 'none', borderRadius: 8, padding: '14px 0', fontFamily: 'Outfit, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
};

Object.assign(window, { ProductDetail });
