import React, { forwardRef } from 'react';
import Barcode from 'react-barcode';

/**
 * ThermalSticker — 75mm x 100mm parcel sticker for Direct Thermal printers
 *
 * Layout (Top → Bottom):
 *   Section 1 (~15%): Brand & Meta — Hamza Fabrics (14px bold), Date, Order ID
 *   Section 2 (~20%): Courier & Barcode — Courier name, SVG barcode (Parcel_ID, 15mm)
 *   Section 3 (~25%): Customer Info — Name, Phone (14px bold), Address (thana, district)
 *   Section 4 (~20%): Itemized List — Item | Qty | Price table with variant info
 *   Section 5 (~20%): Financials & COD Box — Subtotal/Delivery, black COD box (18px bold)
 */
const ThermalSticker = forwardRef(({ order }, ref) => {
  if (!order) return null;

  const customer = order.customer || {};
  const billing = order.billing || {};
  const trackingCode = order.tracking_code || order.invoice || 'N/A';
  const courierName = (order.courier_name || 'COURIER').toUpperCase();
  const orderId = order.invoice || order.id || 'N/A';

  // Parse financials
  const subTotal = billing.subTotal || order.subtotal || 0;
  const deliveryCharge = billing.deliveryCharge || order.delivery_charge || 0;
  const discount = billing.discount || order.discount || 0;
  const codAmount = Number(order.total || subTotal + deliveryCharge - discount).toFixed(2);
  const orderDate = order.date
    ? new Date(order.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  // Parse products with variant info
  let products = [];
  try {
    products = typeof order.products === 'string' ? JSON.parse(order.products) : (order.products || []);
  } catch { products = []; }

  // Format address components
  const rawAddress = customer.address || 'N/A';

  return (
    <div ref={ref} className="thermal-sticker-wrapper">
      {/* Print CSS — injected for react-to-print isolation */}
      <style>{`
        @media print {
          @page { size: 75mm 100mm; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .thermal-sticker-wrapper, .thermal-sticker-wrapper * {
            visibility: visible !important;
          }
        }
        .thermal-sticker-wrapper {
          position: absolute;
          left: -9999px;
          top: 0;
        }
      `}</style>

      <div style={{
        width: '75mm',
        height: '100mm',
        padding: '2.5mm 3mm',
        boxSizing: 'border-box',
        border: '1px solid #000',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        overflow: 'hidden',
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        color: '#000',
        background: '#fff',
      }}>

        {/* ═══════════════════════════════════════════════════
            SECTION 1: Brand & Meta (~15%)
            Left: Brand Name + Date | Right: Order ID
           ═══════════════════════════════════════════════════ */}
        <div style={{
          height: '15%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '1.5px solid #000',
          paddingBottom: '1mm',
          marginBottom: '1mm',
        }}>
          {/* Left: Brand + Date */}
          <div>
            <div style={{ fontSize: '14px', fontWeight: 900, letterSpacing: '0.3px', textTransform: 'uppercase', lineHeight: 1.1 }}>
              Hamza Fabrics
            </div>
            <div style={{ fontSize: '8px', color: '#555', marginTop: '1px', fontWeight: 600 }}>
              {orderDate || 'DD/MM/YYYY'}
            </div>
          </div>
          {/* Right: Order ID */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '6px', color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>
              Order ID
            </div>
            <div style={{
              fontSize: '8px',
              fontWeight: 700,
              fontFamily: 'monospace',
              color: '#000',
              maxWidth: '35mm',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              #{orderId}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            SECTION 2: Courier & Barcode (~20%)
            Courier name + 15mm tall SVG barcode of Parcel_ID
           ═══════════════════════════════════════════════════ */}
        <div style={{
          height: '20%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          borderBottom: '1px dashed #999',
          marginBottom: '1mm',
          paddingBottom: '1mm',
        }}>
          <div style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1mm', color: '#333' }}>
            Courier: {courierName}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <Barcode
              value={trackingCode}
              width={1.3}
              height={30}
              fontSize={8}
              font="monospace"
              textAlign="center"
              displayValue={true}
              textMargin={1}
              margin={0}
              background="transparent"
              lineColor="#000"
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            SECTION 3: Customer Info (~25%)
            To: Name | Phone (14px bold) | Address
           ═══════════════════════════════════════════════════ */}
        <div style={{
          height: '25%',
          borderBottom: '1px dashed #999',
          marginBottom: '1mm',
          paddingBottom: '1mm',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '0.5mm',
        }}>
          {/* To: Name */}
          <div style={{ fontWeight: 700, fontSize: '10px', lineHeight: 1.2 }}>
            <span style={{ color: '#555', fontWeight: 600, fontSize: '8px' }}>TO: </span>
            {customer.name || 'N/A'}
          </div>

          {/* Phone — 14px bold, critical for deliverymen */}
          <div style={{
            fontSize: '14px',
            fontWeight: 700,
            fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
            letterSpacing: '0.5px',
            padding: '0.5mm 0',
            wordSpacing: '1px',
          }}>
            {customer.phone || 'N/A'}
          </div>

          {/* Address */}
          <div style={{ fontSize: '8px', color: '#333', lineHeight: 1.3, overflow: 'hidden', wordBreak: 'break-word' }}>
            {rawAddress}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            SECTION 4: Itemized List (~20%)
            Table: Item | Qty | Price (with variant info)
           ═══════════════════════════════════════════════════ */}
        <div style={{
          height: '20%',
          borderBottom: '1px dashed #999',
          marginBottom: '1mm',
          paddingBottom: '1mm',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Table Header */}
          <div style={{
            display: 'flex',
            fontSize: '6px',
            fontWeight: 700,
            color: '#555',
            borderBottom: '0.5px solid #ccc',
            paddingBottom: '0.5mm',
            marginBottom: '0.5mm',
            textTransform: 'uppercase',
          }}>
            <span style={{ flex: 3 }}>Item</span>
            <span style={{ flex: 0.5, textAlign: 'center' }}>Qty</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Price</span>
          </div>

          {/* Items */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {products.slice(0, 3).map((p, i) => {
              const name = p.productName || p.name || 'Item';
              const qty = Number(p.qty || p.quantity || 1);
              const price = Number(p.price || p.unit_price || 0);
              const variant = p.variant_sku || p.size || p.color || '';
              const sku = p.sku || p.product_sku || '';

              // Smart name: include variant if present
              let displayName = name;
              if (variant) displayName = `${name} (${variant})`;

              return (
                <div key={i} style={{
                  display: 'flex',
                  fontSize: '6.5px',
                  lineHeight: 1.4,
                  marginBottom: '0.3mm',
                  alignItems: 'center',
                }}>
                  <span style={{
                    flex: 3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    paddingRight: '1mm',
                  }}>
                    {displayName}{sku ? ` [${sku}]` : ''}
                  </span>
                  <span style={{ flex: 0.5, textAlign: 'center', fontWeight: 700 }}>
                    {qty}x
                  </span>
                  <span style={{ flex: 1, textAlign: 'right', fontWeight: 600 }}>
                    ৳{price.toFixed(2)}
                  </span>
                </div>
              );
            })}
            {products.length > 3 && (
              <div style={{ fontSize: '5.5px', color: '#999', marginTop: '0.5mm' }}>
                +{products.length - 3} more items
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            SECTION 5: Financials & COD Box (~20%)
            Subtotal / Delivery / Discount | Black COD box
            Footer: "Unstitched Fabrics - No Return After Use"
           ═══════════════════════════════════════════════════ */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          gap: '0.5mm',
        }}>
          {/* Financial Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', fontWeight: 600, lineHeight: 1.5, padding: '0 0.5mm' }}>
            <span>Subtotal: ৳{Number(subTotal).toFixed(2)}</span>
            <span>Delivery: ৳{Number(deliveryCharge).toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div style={{ textAlign: 'right', fontSize: '6px', color: '#888', padding: '0 0.5mm' }}>
              Discount: -৳{Number(discount).toFixed(2)}
            </div>
          )}

          {/* COD Box — Solid black rectangle, white text */}
          <div style={{
            background: '#000',
            color: '#fff',
            padding: '1.5mm 2mm',
            borderRadius: '0.5mm',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.5mm',
          }}>
            <span style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              COD
            </span>
            <span style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '0.3px', lineHeight: 1 }}>
              ৳{codAmount} TK
            </span>
          </div>

          {/* Footer Note */}
          <div style={{
            fontSize: '5.5px',
            color: '#888',
            textAlign: 'center',
            padding: '0 0.5mm',
            fontStyle: 'italic',
          }}>
            Unstitched Fabrics — No Return After Use
          </div>
        </div>

      </div>
    </div>
  );
});

ThermalSticker.displayName = 'ThermalSticker';

export default ThermalSticker;
