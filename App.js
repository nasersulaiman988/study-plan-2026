import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { 
  Plus, ShoppingCart, Receipt, Package, Trash2, Clock, ChevronRight,
  LayoutDashboard, Settings, MapPin, CreditCard, ListChecks,
  Edit3, Hammer, ChefHat, Calculator, AlertTriangle, CheckCircle2, Check,
  Filter, DollarSign, PieChart, ShoppingBag, Truck, BarChart2, TrendingUp, Box, RefreshCcw, MessageCircle
} from 'lucide-react';

// --- 1. إعدادات السحابة ---
const firebaseConfig = {
  // ⚠️ ضع مفتاحك الحقيقي هنا بدلاً من المفتاح الوهمي
  apiKey: "AIzaSyAZWCNPs0ywrXoputhVvULPQaHLrbVIR_o", 
  authDomain: "sweets-app-d5d06.firebaseapp.com",
  projectId: "sweets-app-d5d06",
  storageBucket: "sweets-app-d5d06.firebasestorage.app",
  messagingSenderId: "93392791640",
  appId: "1:93392791640:web:63134b221e6acb99b9422d",
  measurementId: "G-SYG2NNT5FX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "sweets-manager-v1";

// --- 2. ثوابت ودوال مساعدة ---
const DEFAULT_DATE = '2026-03-18'; 
const UNITS_LIST = ['كجم', 'لتر', 'كيس (10كغ)', 'علبة (500غ)', 'عبوة (700مل)', 'عبوة (4.6كغ)', 'عبوة (2.3كغ)', 'عبوة (1.15كغ)', 'عبوة (1.6كغ)', 'عبوة (800غ)', 'جرام', 'مل', 'حبة', 'كرتون'];
const UNIT_MULTIPLIERS = { 'كيس (10كغ)': 10, 'علبة (500غ)': 0.5, 'عبوة (700مل)': 0.7, 'عبوة (4.6كغ)': 4.6, 'عبوة (2.3كغ)': 2.3, 'عبوة (1.15كغ)': 1.15, 'عبوة (1.6كغ)': 1.6, 'عبوة (800غ)': 0.8, 'كجم': 1, 'لتر': 1, 'جرام': 0.001, 'مل': 0.001, 'حبة': 1, 'كرتون': 1 };

function getLocalYYYYMMDD(d) { if(!d)return""; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function formatDisplayDate(s) { if(!s)return''; return s.split('-').reverse().join('/'); }
function calculateCommercialUnits(m,v){if(!v||v<=0)return"-";if(m==='flour')return`${Math.ceil(v/10)} كيس (10كغ)`;if(m==='sugar')return`${Math.ceil(v/0.5)} علبة (500غ)`;if(m==='mazahr')return`${Math.ceil(v/0.7)} عبوة (700مل)`;if(m==='aseel'){let r=v,c46=Math.floor(r/4.6);r%=4.6;let c23=Math.floor(r/2.3);r%=2.3;let c115=Math.ceil(r/1.15);if(c115===2){c23++;c115=0;}if(c23===2){c46++;c23=0;}let res=[];if(c46>0)res.push(`${c46} عبوة (4.6كغ)`);if(c23>0)res.push(`${c23} عبوة (2.3كغ)`);if(c115>0)res.push(`${c115} عبوة (1.15كغ)`);return res.join(' + ');}if(m==='marai'){let r=v,c16=Math.floor(r/1.6);r%=1.6;let c08=Math.ceil(r/0.8);if(c08===2){c16++;c08=0;}let res=[];if(c16>0)res.push(`${c16} عبوة (1.6كغ)`);if(c08>0)res.push(`${c08} عبوة (800غ)`);return res.join(' + ');}return null;}

const INITIAL_PRODUCTS = [{ id:1, name:"معمول مشكل", price:8, piecesPerKg:40 },{ id:2, name:"معمول تمر", price:6.5, piecesPerKg:40 },{ id:3, name:"معمول جوز", price:8.5, piecesPerKg:40 },{ id:4, name:"معمول فستق", price:10, piecesPerKg:40 },{ id:5, name:"غريبة سادة", price:6, piecesPerKg:50 },{ id:6, name:"غريبة بالفستق", price:6.5, piecesPerKg:50 },{ id:7, name:"غريبة مكس", price:6.3, piecesPerKg:50 },{ id:8, name:"بيتيفور", price:6.5, piecesPerKg:60 },{ id:9, name:"معمول تمر وجوز", price:7.5, piecesPerKg:40 },{ id:10, name:"معمول تمر وفستق", price:8.5, piecesPerKg:40 },{ id:11, name:"معمول جوز وفستق", price:9.5, piecesPerKg:40 }];
const ORDER_STATUSES = [{ id:'NotReady', label:'غير جاهز', color:'bg-red-100 text-red-700' },{ id:'ReadyForPacking', label:'جاهز للتغليف', color:'bg-blue-100 text-blue-700' },{ id:'Ready', label:'جاهز', color:'bg-amber-100 text-amber-700' },{ id:'Delivered', label:'تم التسليم', color:'bg-green-100 text-green-700' }];
const CURRENCY = "ر.ع"; const BASIC_ITEM_NAMES = ["معمول تمر", "معمول جوز", "معمول فستق", "غريبة سادة", "غريبة بالفستق", "بيتيفور"]; const EXPECTED_ITEM_NAMES = ["معمول مشكل", "معمول تمر", "معمول جوز", "معمول فستق", "غريبة سادة", "غريبة بالفستق", "بيتيفور", "معمول تمر وجوز", "معمول تمر وفستق", "معمول جوز وفستق"];

// --- 3. واجهات المكونات الفرعية ---
const Sidebar = ({ view, setView, isSidebarOpen, setIsSidebarOpen }) => (
  <div className={`fixed inset-y-0 right-0 z-50 w-64 bg-amber-900 text-white transform ${isSidebarOpen?'translate-x-0':'translate-x-full'} lg:translate-x-0 transition-transform shadow-xl flex flex-col text-right border-l border-amber-800`}>
    <div className="p-6 border-b border-amber-800 shrink-0"><h1 className="text-2xl font-black flex items-center gap-2 justify-end tracking-tighter">أطايب الشام <ChefHat className="text-amber-400" size={28} /></h1></div>
    <nav className="flex-1 overflow-y-auto py-4">
      {[{ id:'dashboard', label:'الرئيسية', icon:LayoutDashboard },{ id:'new-order', label:'طلب جديد', icon:Plus },{ id:'orders', label:'سجل الطلبات', icon:ShoppingCart },{ id:'ready-items', label:'تفاصيل التعبئة', icon:CheckCircle2 },{ id:'production-log', label:'تسجيل المخبوز', icon:Hammer },{ id:'production-stats', label:'إحصائيات الإنجاز', icon:PieChart },{ id:'materials', label:'حساب المواد (BOM)', icon:ChefHat },{ id:'expected-materials', label:'التوقعات', icon:Calculator },{ id:'payments', label:'المدفوعات', icon:CreditCard },{ id:'expenses', label:'المخزون', icon:Receipt },{ id:'products', label:'الإعدادات', icon:Settings }].map(i => (
        <button key={i.id} onClick={()=>{setView(i.id);setIsSidebarOpen(false);}} className={`w-full flex items-center justify-end gap-4 px-6 py-3 hover:bg-amber-800 transition-all ${view===i.id?'bg-amber-700 border-l-4 border-amber-400 font-bold':''}`}><span className="text-sm">{i.label}</span><i.icon size={18} /></button>
      ))}
    </nav>
  </div>
);

const InputGroup = ({ label, type="text", val, setVal, placeholder="", step="any" }) => (
  <div className="space-y-1 text-right w-full"><label className="text-[10px] font-bold text-gray-500 pr-1 uppercase">{label}</label><input type={type} step={step} className={`w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 ${type==='date'?'text-left':'text-right'}`} value={val} onChange={e=>setVal(e.target.value)} placeholder={placeholder} dir={type==='date'?'ltr':'rtl'} /></div>
);

const StatBox = ({ title, val, color, isCur=true }) => {
  const colors = { blue:'border-blue-500 text-blue-700 bg-blue-50', green:'border-green-500 text-green-700 bg-green-50', red:'border-red-500 text-red-700 bg-red-50', amber:'border-amber-500 text-amber-900 bg-amber-50', purple:'border-purple-500 text-purple-700 bg-purple-50' };
  return (<div className={`p-4 rounded-2xl shadow-sm border-t-4 ${colors[color]} text-right transition-transform hover:scale-[1.02] flex flex-col justify-between`}><p className="text-[10px] opacity-70 font-bold uppercase mb-1">{title}</p><h3 className="text-xl font-black mt-1 truncate">{isCur?Number(val||0).toFixed(2):Number(val||0).toFixed(1)} {isCur&&<span className="text-[10px] font-normal opacity-70 mr-1">{CURRENCY}</span>}</h3></div>);
};

const HighlightStatBox = ({ title, val, colorClass, isCur=true, icon:Icon }) => (
  <div className={`p-6 rounded-3xl shadow-md border ${colorClass} text-right transform hover:-translate-y-1 transition-all relative overflow-hidden flex flex-col justify-between h-full`}><div className="absolute -left-6 -top-6 w-32 h-32 bg-white opacity-20 rounded-full blur-2xl"></div><div className="flex justify-between items-start mb-2 relative z-10">{Icon&&<Icon className="opacity-70" size={24} />}<p className="text-sm font-black uppercase opacity-90">{title}</p></div><h3 className="text-4xl font-black truncate relative z-10 mt-2">{isCur?Number(val||0).toFixed(2):Number(val||0).toFixed(1)} {isCur&&<span className="text-sm font-bold opacity-80 mr-1">{CURRENCY}</span>}</h3></div>
);

const MaterialStat = ({ name, val, unit }) => (<div className="bg-gray-50 p-4 rounded-2xl border flex flex-col items-center justify-center text-center"><span className="text-[10px] font-bold text-gray-500 mb-1">{name}</span><span className="text-lg font-black text-gray-800">{Number(val||0).toFixed(3)} <span className="text-[10px] font-normal text-gray-400">{unit}</span></span></div>);
const UnitMaterialStat = ({ name, val, unitStr, defaultUnit }) => (<div className="bg-white p-4 rounded-2xl border flex flex-col items-center justify-center text-center shadow-sm"><span className="text-[10px] font-bold text-gray-500 mb-1">{name}</span><span className="text-lg font-black text-amber-900">{Number(val||0).toFixed(3)} <span className="text-[10px] font-normal text-gray-400">{defaultUnit}</span></span>{unitStr&&unitStr!=="-"&&(<div className="bg-amber-50 px-2 py-1.5 rounded-lg w-full border border-amber-100 mt-2 text-center"><span className="text-[10px] font-bold text-amber-800 whitespace-pre-line">{String(unitStr)}</span></div>)}</div>);

// --- 4. التطبيق الأساسي ---
export default function App() {
  const [view, setView] = useState('dashboard'); 
  const [user, setUser] = useState(null); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [orders, setOrders] = useState([]); 
  const [productionLogs, setProductionLogs] = useState([]); 
  const [expenses, setExpenses] = useState([]); 
  const [purchaseTargets, setPurchaseTargets] = useState([]); 
  const [products, setProducts] = useState(INITIAL_PRODUCTS); 
  const [doughInventory, setDoughInventory] = useState({ maamoul: 0, ghorayeba: 0 }); 
  const [inventorySettings, setInventorySettings] = useState({ basicExisting: {}, customItems: [] }); 
  
  const [currentOrder, setCurrentOrder] = useState({ id: null, customerName: '', phone: '', address: '', deliveryRequired: 'no', deliveryFee: '', packagingFee: '', discount: '', notes: '', items: [], paidAmount: 0, status: 'NotReady', deliveryDate: DEFAULT_DATE });
  const [prodEntry, setProdEntry] = useState({ productId: '', quantity: '', inputType: 'kg' });
  const [expectedQty, setExpectedQty] = useState({ "معمول مشكل": '', "معمول تمر": '', "معمول جوز": '', "معمول فستق": '', "غريبة سادة": '', "غريبة بالفستق": '', "بيتيفور": '', "معمول تمر وجوز": '', "معمول تمر وفستق": '', "معمول جوز وفستق": '' });
  const [newExpense, setNewExpense] = useState({ description: '', unit: '', quantity: '', unitPrice: '' }); 
  const [newTarget, setNewTarget] = useState({ name: '', target: '', existing: '', unit: 'حبة' });
  
  const [paymentModal, setPaymentModal] = useState({ isOpen: false, order: null, amount: '' }); 
  const [recalcModal, setRecalcModal] = useState(false);
  
  const [filters, setFilters] = useState({ name: '', date: '', address: '', delivery: 'all', status: 'all', product: 'all', payment: 'all' });
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { actualTodayStr, actualTomorrowStr } = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return { actualTodayStr: getLocalYYYYMMDD(today), actualTomorrowStr: getLocalYYYYMMDD(tomorrow) };
  }, []);

  const dailyTotalKg = useMemo(() => productionLogs.filter(l => l.date === actualTodayStr).reduce((sum, l) => sum + parseFloat(l.quantity || 0), 0), [productionLogs, actualTodayStr]);

  useEffect(() => {
    document.title = "أطايب الشام";
    if (!document.getElementById('tailwind-cdn')) { const s = document.createElement('script'); s.id = 'tailwind-cdn'; s.src = 'https://cdn.tailwindcss.com'; document.head.appendChild(s); }
  }, []);

  useEffect(() => { const initAuth = async () => { try { await signInAnonymously(auth); } catch (e) { setUser({ uid: 'local-preview-mode' }); } }; initAuth(); return onAuthStateChanged(auth, (u) => { if(u) setUser(u); }); }, []);

  useEffect(() => {
    if (!user || user.uid === 'local-preview-mode') return;
    const qBase = (coll) => collection(db, 'artifacts', appId, 'public', 'data', coll);
    const unsubs = [
      onSnapshot(qBase('orders'), s => setOrders(s.docs.map(d => ({...d.data(), id: d.id})))),
      onSnapshot(qBase('productionLogs'), s => setProductionLogs(s.docs.map(d => ({...d.data(), id: d.id})))),
      onSnapshot(qBase('expenses'), s => setExpenses(s.docs.map(d => ({...d.data(), id: d.id})))),
      onSnapshot(qBase('products'), s => { const c = s.docs.map(d => ({...d.data(), id: parseInt(d.id) || d.id})); if(c.length>0) setProducts(p => p.map(pr => ({ ...pr, ...(c.find(x => x.id === pr.id) || {}) }))); }),
      onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'doughInventory'), d => { if (d.exists()) setDoughInventory(d.data()); }),
      onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'inventorySettings'), d => { if (d.exists()) setInventorySettings(d.data()); })
    ];
    return () => unsubs.forEach(u => u());
  }, [user]);

  // --- دوال الحفظ والعمليات ---
  const handleSaveOrder = async () => {
    if(!user || !currentOrder.customerName) return; const id = currentOrder.id || Date.now().toString();
    const cleanedItems = currentOrder.items.map(item => ({ ...item, quantity: parseFloat(item.quantity) || 0, isReady: !!item.isReady }));
    const finalOrder = { ...currentOrder, items: cleanedItems, id };
    if (user.uid === 'local-preview-mode') setOrders(prev => { const ex = prev.find(o=>o.id===id); return ex ? prev.map(o=>o.id===id?finalOrder:o) : [finalOrder, ...prev]; });
    else await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', id), finalOrder);
    setCurrentOrder({ id: null, customerName: '', phone: '', address: '', deliveryRequired: 'no', deliveryFee: '', packagingFee: '', discount: '', notes: '', items: [], paidAmount: 0, status: 'NotReady', deliveryDate: DEFAULT_DATE });
    setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000);
  };
  const handleDeleteOrder = async (id) => { if (user.uid === 'local-preview-mode') setOrders(prev => prev.filter(o => o.id !== id)); else await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', id)); };
  const handleUpdateOrderStatus = async (order, newStatus) => { if (user.uid === 'local-preview-mode') setOrders(prev => prev.map(o => o.id === order.id ? {...o, status: newStatus} : o)); else await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.id), {...order, status: newStatus}, {merge:true}); };
  const toggleItemReady = async (order, itemIndex, isChecked) => { const newItems = [...order.items]; newItems[itemIndex] = { ...newItems[itemIndex], isReady: isChecked }; if (user.uid === 'local-preview-mode') setOrders(prev => prev.map(o => o.id === order.id ? {...o, items: newItems} : o)); else await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.id.toString()), {...order, items: newItems}, {merge: true}); };
  
  const sendWhatsAppMsg = (order) => {
    if (!order.phone) {
        alert("عذراً، لم يتم تسجيل رقم هاتف لهذا الزبون.");
        return;
    }
    let itemsList = order.items.map(i => `▪️ ${i.name}: ${i.quantity} كجم`).join('\n');
    let total = (order.items.reduce((s,i)=>s+(parseFloat(i.price||0)*parseFloat(i.quantity||0)),0) + parseFloat(order.deliveryFee||0) + parseFloat(order.packagingFee||0) - parseFloat(order.discount||0)).toFixed(2);
    let rem = (parseFloat(total) - parseFloat(order.paidAmount||0)).toFixed(2);
    let msg = `أهلاً بك في *أطايب الشام* 🥮\n\nتم تسجيل طلبك بنجاح عزيزي/عزيزتي: *${order.customerName}*\n\n*تفاصيل الطلب:*\n${itemsList}\n`;
    if(parseFloat(order.packagingFee) > 0) msg += `\nتغليف خاص: ${parseFloat(order.packagingFee).toFixed(2)} ر.ع`;
    if(order.deliveryRequired === 'yes') msg += `\nتوصيل: ${parseFloat(order.deliveryFee).toFixed(2)} ر.ع`;
    if(parseFloat(order.discount) > 0) msg += `\nخصم: -${parseFloat(order.discount).toFixed(2)} ر.ع`;
    msg += `\n\n*الإجمالي المطلوب:* ${total} ر.ع`;
    if(parseFloat(order.paidAmount) > 0) msg += `\n*المدفوع:* ${parseFloat(order.paidAmount).toFixed(2)} ر.ع\n*الباقي:* ${rem} ر.ع`;
    msg += `\n\n*تاريخ التسليم:* ${formatDisplayDate(order.deliveryDate)}\n\nنشكر ثقتكم بنا!`;
    let cleanPhone = order.phone.replace(/\D/g, ''); if (cleanPhone.length === 8) cleanPhone = '968' + cleanPhone;
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleSaveLog = async () => {
    if (!user || !prodEntry.productId || !prodEntry.quantity) return; const p = products.find(x => x.id === parseInt(prodEntry.productId)); let fKg = parseFloat(prodEntry.quantity); if (prodEntry.inputType === 'pieces') { const ppk = p.piecesPerKg || (p.name.includes("غريبة") ? 50 : 40); fKg /= ppk; }
    const id = Date.now().toString(); const finalLog = { id, productName: p.name, quantity: fKg, date: actualTodayStr };
    if (user.uid === 'local-preview-mode') setProductionLogs(prev => [finalLog, ...prev]); else await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'productionLogs', id), finalLog); setProdEntry({ productId: '', quantity: '', inputType: 'kg' });
  };
  const handleDeleteLog = async (id) => { if (user.uid === 'local-preview-mode') setProductionLogs(prev => prev.filter(l => l.id !== id)); else await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'productionLogs', id)); };
  
  const executeRecalculation = async () => {
    if (user.uid === 'local-preview-mode') setProductionLogs([]);
    else { const ps = productionLogs.map(l => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'productionLogs', l.id))); await Promise.all(ps); }
    setRecalcModal(false);
  };

  const handleSaveExpense = async () => {
    if (!user || !newExpense.description || (!newExpense.quantity && !newExpense.unitPrice)) return;
    const qty = parseFloat(newExpense.quantity) || 1, price = parseFloat(newExpense.unitPrice) || 0, mult = UNIT_MULTIPLIERS[newExpense.unit] || 1;
    const exp = { id: Date.now().toString(), description: newExpense.description, unit: newExpense.unit, quantity: qty, standardQuantity: qty * mult, unitPrice: price, amount: qty * price, date: actualTodayStr };
    if (user.uid === 'local-preview-mode') setExpenses(prev => [exp, ...prev]); else await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', exp.id), exp); setNewExpense({ description: '', unit: '', quantity: '', unitPrice: '' });
  };
  const handleDeleteExpense = async (id) => { if (user.uid === 'local-preview-mode') setExpenses(prev => prev.filter(e => e.id !== id)); else await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', id)); };

  const updateBasicExisting = async (key, val) => { const n = { ...inventorySettings, basicExisting: { ...inventorySettings.basicExisting, [key]: parseFloat(val) || 0 } }; if (user.uid === 'local-preview-mode') setInventorySettings(n); else await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'inventorySettings'), n, {merge: true}); };
  const addCustomInventoryItem = async () => { if(!user || !newTarget.name) return; const n = { ...inventorySettings, customItems: [...(inventorySettings.customItems||[]), { id: Date.now().toString(), name: newTarget.name, target: parseFloat(newTarget.target)||0, existing: parseFloat(newTarget.existing)||0, unit: newTarget.unit||'حبة' }] }; if (user.uid === 'local-preview-mode') setInventorySettings(n); else await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'inventorySettings'), n, {merge: true}); setNewTarget({name:'', target:'', existing:'', unit:'حبة'}); };
  const deleteCustomInventoryItem = async (id) => { const n = { ...inventorySettings, customItems: (inventorySettings.customItems||[]).filter(i => i.id !== id) }; if (user.uid === 'local-preview-mode') setInventorySettings(n); else await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'inventorySettings'), n, {merge: true}); }
  const updateCustomItemExisting = async (id, val) => { const n = { ...inventorySettings, customItems: (inventorySettings.customItems||[]).map(i => i.id === id ? {...i, existing: parseFloat(val)||0} : i) }; if (user.uid === 'local-preview-mode') setInventorySettings(n); else await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'inventorySettings'), n, {merge: true}); }
  const handleUpdateDough = async (type, val) => { const n = { ...doughInventory, [type]: parseFloat(val) || 0 }; if (user.uid === 'local-preview-mode') setDoughInventory(n); else await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'doughInventory'), n, { merge: true }); };
  const handleUpdateProduct = async (p, field, val) => { const n = {...p, [field]: parseFloat(val) || 0}; if (user.uid === 'local-preview-mode') setProducts(prev => prev.map(item => item.id === p.id ? n : item)); else await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', p.id.toString()), n, {merge: true}); };

  const savePayment = async () => {
    if(!user || !paymentModal.order || !paymentModal.amount) return; const nPaid = (parseFloat(paymentModal.order.paidAmount)||0) + parseFloat(paymentModal.amount);
    if (user.uid === 'local-preview-mode') setOrders(prev => prev.map(o => o.id === paymentModal.order.id ? {...o, paidAmount: nPaid} : o)); else await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', paymentModal.order.id), { paidAmount: nPaid }, { merge: true }); setPaymentModal({ isOpen: false, order: null, amount: '' });
  };

  const editOrder = (order) => {
    setCurrentOrder({...order});
    setView('new-order');
  };

  // --- حسابات ---
  const stats = useMemo(() => {
    let sales = 0, delivery = 0, packaging = 0, paid = 0, totalDiscount = 0;
    orders.forEach(o => {
        const itemsT = (o.items || []).reduce((s, i) => s + ((parseFloat(i.price)||0) * (parseFloat(i.quantity)||0)), 0);
        const disc = parseFloat(o.discount) || 0, deliv = parseFloat(o.deliveryFee) || 0, pkg = parseFloat(o.packagingFee) || 0;
        sales += (itemsT + pkg - disc); delivery += deliv; packaging += pkg; paid += (parseFloat(o.paidAmount) || 0); totalDiscount += disc;
    });
    const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    return { sales, delivery, packaging, total: sales + delivery, paid, rem: (sales + delivery) - paid, totalExpenses, profit: sales - totalExpenses, totalDiscount };
  }, [orders, expenses]);

  const completionSummary = useMemo(() => {
    const sum = {}; BASIC_ITEM_NAMES.forEach(n => { sum[n] = { required: 0, producedLog: 0, readyInOrders: 0, effectiveProduced: 0 }; });
    orders.forEach(o => {
      const orderIsReady = o.status === 'Ready' || o.status === 'Delivered';
      (o.items || []).forEach(i => {
        const q = parseFloat(i.quantity) || 0; const isItemReady = !!i.isReady || orderIsReady;
        const addQty = (name, amount, rFlag) => { if (sum[name]) { sum[name].required += amount; if (rFlag) sum[name].readyInOrders += amount; } };
        if (i.name === "معمول مشكل") { addQty("معمول تمر", q*0.4, isItemReady); addQty("معمول جوز", q*0.3, isItemReady); addQty("معمول فستق", q*0.3, isItemReady); }
        else if (i.name.includes("جوز+فستق") || i.name === "معمول جوز وفستق") { addQty("معمول جوز", q*0.5, isItemReady); addQty("معمول فستق", q*0.5, isItemReady); }
        else if (i.name.includes("تمر+فستق") || i.name === "معمول تمر وفستق") { addQty("معمول تمر", q*0.5, isItemReady); addQty("معمول فستق", q*0.5, isItemReady); }
        else if (i.name.includes("تمر+جوز") || i.name === "معمول تمر وجوز") { addQty("معمول تمر", q*0.5, isItemReady); addQty("معمول جوز", q*0.5, isItemReady); }
        else if (i.name === "غريبة مكس") { addQty("غريبة سادة", q*0.5, isItemReady); addQty("غريبة بالفستق", q*0.5, isItemReady); }
        else if (sum[i.name]) { addQty(i.name, q, isItemReady); }
      });
    });
    productionLogs.forEach(l => { if (sum[l.productName]) sum[l.productName].producedLog += parseFloat(l.quantity || 0); });
    BASIC_ITEM_NAMES.forEach(n => { sum[n].effectiveProduced = sum[n].readyInOrders + sum[n].producedLog; });
    return sum;
  }, [orders, productionLogs]);

  const readyItemsDetails = useMemo(() => {
     const details = {}; INITIAL_PRODUCTS.forEach(p => { details[p.name] = { req: 0, ready: 0 }; });
     orders.forEach(o => {
         const orderIsReady = o.status === 'Ready' || o.status === 'Delivered';
         (o.items || []).forEach(i => {
             const q = parseFloat(i.quantity) || 0; const isItemReady = !!i.isReady || orderIsReady;
             if (!details[i.name]) details[i.name] = { req: 0, ready: 0 };
             details[i.name].req += q; if (isItemReady) details[i.name].ready += q;
         });
     });
     return details;
  }, [orders]);

  const totalReqKg = Object.values(completionSummary).reduce((a, b) => a + b.required, 0);
  const totalProdKg = Object.values(completionSummary).reduce((a, b) => a + b.effectiveProduced, 0);
  const totalRemKg = Object.values(completionSummary).reduce((a, b) => a + Math.max(0, b.required - b.effectiveProduced), 0);
  const totalReadyKg = orders.reduce((s, o) => s + ((o.items || []).reduce((s2, i) => s2 + ((i.isReady || o.status === 'Ready' || o.status === 'Delivered') ? parseFloat(i.quantity || 0) : 0), 0) || 0), 0);

  const materialsBOM = useMemo(() => {
    const getPPK = (n) => products.find(p => p.name === n)?.piecesPerKg || (n.includes("غريبة") ? 50 : 40);
    const remKg = (n) => Math.max(0, (completionSummary[n]?.required || 0) - (completionSummary[n]?.effectiveProduced || 0));
    const tamerP = remKg("معمول تمر") * getPPK("معمول تمر"), jowzP = remKg("معمول جوز") * getPPK("معمول جوز"), fistqP = remKg("معمول فستق") * getPPK("معمول فستق");
    const maamoulReqB = ((tamerP + jowzP + fistqP) * 15) / 1900, maamoulRemB = Math.max(0, maamoulReqB - (doughInventory.maamoul || 0));
    const ghorReqKg = remKg("غريبة سادة") + remKg("غريبة بالفستق"), ghorReqB = (ghorReqKg * 1150) / 1750, ghorRemB = Math.max(0, ghorReqB - (doughInventory.ghorayeba || 0));
    return {
      maamoul: { req: maamoulReqB, rem: maamoulRemB }, ghor: { req: ghorReqB, rem: ghorRemB },
      raw: { flour: (maamoulRemB * 800 + ghorRemB * 1000) / 1000, semolina: (maamoulRemB * 200) / 1000, aseel: (maamoulRemB * 250 + ghorRemB * 250) / 1000, marai: (maamoulRemB * 250 + ghorRemB * 250) / 1000, sugar: (maamoulRemB * 200 + ghorRemB * 250) / 1000, mazahr: (maamoulRemB * 100) / 1000, mahlab: (maamoulRemB * 5) / 1000, tamer: (tamerP * 10) / 1000, jowz: (jowzP * 6) / 1000, fistq: (fistqP * 5) / 1000 }
    };
  }, [completionSummary, products, doughInventory]);

  // التعديل هنا: إضافة الأساسيات دائماً لضمان ظهورها في القائمة المنسدلة
  const allPurchaseTargets = useMemo(() => {
    const targets = [];
    const addBasic = (key, name, unit) => { 
        const req = materialsBOM.raw[key] || 0;
        const existing = inventorySettings.basicExisting?.[key] || 0; 
        // تمت إزالة شرط (req > 0) لضمان ظهور المادة دائماً في القائمة المنسدلة
        targets.push({ id: `basic-${key}`, key, name, required: req, existing, unit, isBasic: true }); 
    };
    addBasic('flour', 'طحين', 'كجم'); addBasic('sugar', 'سكر بودرة', 'كجم'); addBasic('aseel', 'سمن أصيل', 'كجم'); addBasic('marai', 'سمن مراعي', 'كجم'); addBasic('mazahr', 'ماء زهر', 'لتر'); addBasic('semolina', 'سميد', 'كجم'); addBasic('tamer', 'تمر', 'كجم'); addBasic('jowz', 'جوز', 'كجم'); addBasic('fistq', 'فستق', 'كجم');
    (inventorySettings.customItems || []).forEach(ci => { targets.push({ id: ci.id, name: ci.name, required: ci.target, existing: ci.existing, unit: ci.unit, isBasic: false }); });
    return targets.map(t => {
        const purchased = expenses.filter(e => e.description.trim() === t.name.trim()).reduce((s, e) => s + (parseFloat(e.standardQuantity) || parseFloat(e.quantity) || 0), 0);
        return { ...t, purchased, remainingToBuy: Math.max(0, Math.max(0, t.required - t.existing) - purchased), surplus: Math.max(0, (t.existing + purchased) - t.required) };
    });
  }, [materialsBOM, inventorySettings, expenses]); 

  const expectedBOM = useMemo(() => {
    const getPPK = (n) => products.find(p => p.name === n)?.piecesPerKg || (n.includes("غريبة") ? 50 : 40);
    const getKg = (n) => parseFloat(expectedQty[n] || 0);
    const mixKg = getKg("معمول مشكل");
    const tTotal = getKg("معمول تمر") + (mixKg * 0.4) + (getKg("معمول تمر وجوز") * 0.5) + (getKg("معمول تمر وفستق") * 0.5);
    const jTotal = getKg("معمول جوز") + (mixKg * 0.3) + (getKg("معمول تمر وجوز") * 0.5) + (getKg("معمول جوز وفستق") * 0.5);
    const fTotal = getKg("معمول فستق") + (mixKg * 0.3) + (getKg("معمول تمر وفستق") * 0.5) + (getKg("معمول جوز وفستق") * 0.5);
    const tamerP = tTotal * getPPK("معمول تمر"), jowzP = jTotal * getPPK("معمول جوز"), fistqP = fTotal * getPPK("معمول فستق");
    const maamoulReqB = ((tamerP + jowzP + fistqP) * 15) / 1900;
    const ghorReqKg = getKg("غريبة سادة") + getKg("غريبة بالفستق") + getKg("غريبة مكس");
    const ghorReqB = (ghorReqKg * 1150) / 1750;
    return {
      maamoulBatches: maamoulReqB, ghorBatches: ghorReqB,
      raw: { flour: (maamoulReqB * 800 + ghorReqB * 1000) / 1000, semolina: (maamoulReqB * 200) / 1000, aseel: (maamoulReqB * 250 + ghorReqB * 250) / 1000, marai: (maamoulReqB * 250 + ghorReqB * 250) / 1000, sugar: (maamoulReqB * 200 + ghorReqB * 250) / 1000, mazahr: (maamoulReqB * 100) / 1000, tamer: (tamerP * 10) / 1000, jowz: (jowzP * 6) / 1000, fistq: (fistqP * 5) / 1000 }
    };
  }, [expectedQty, products]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (filters.name && !o.customerName.includes(filters.name)) return false;
      if (filters.address && (!o.address || !o.address.includes(filters.address))) return false;
      if (filters.date && o.deliveryDate !== filters.date) return false;
      if (filters.delivery !== 'all' && o.deliveryRequired !== filters.delivery) return false;
      if (filters.status !== 'all' && o.status !== filters.status) return false;
      if (filters.product !== 'all' && !(o.items||[]).some(i => i.name === filters.product)) return false; 
      
      // التعديل: إصلاح فلتر الديون باستخدام التحويل الصارم لتفادي أخطاء الكسور
      if (filters.payment !== 'all') {
         const tot = (o.items || []).reduce((s, i) => s + ((parseFloat(i.price) || 0) * (parseFloat(i.quantity) || 0)), 0) + (parseFloat(o.deliveryFee) || 0) + (parseFloat(o.packagingFee) || 0) - (parseFloat(o.discount) || 0);
         const paid = parseFloat(o.paidAmount) || 0;
         const rem = tot - paid;
         if (filters.payment === 'paid' && rem > 0.05) return false;
         if (filters.payment === 'unpaid' && rem <= 0.05) return false;
      }
      return true;
    }).sort((a,b) => parseInt(b.id) - parseInt(a.id)); 
  }, [orders, filters]);

  const dateOrderSummary = useMemo(() => {
    if (!filters.date) return null;
    const summary = {}; filteredOrders.forEach(o => { (o.items||[]).forEach(i => { if (!summary[i.name]) summary[i.name] = 0; summary[i.name] += (parseFloat(i.quantity) || 0); }); });
    return summary;
  }, [filteredOrders, filters.date]);

  const dailyChartData = useMemo(() => {
    const grouped = {}; productionLogs.forEach(l => { if(!grouped[l.date]) grouped[l.date] = 0; grouped[l.date] += parseFloat(l.quantity || 0); });
    const sortedDates = Object.keys(grouped).sort((a,b) => new Date(a) - new Date(b)).slice(-7);
    return { grouped, sortedDates, maxVal: Math.max(...Object.values(grouped), 1) };
  }, [productionLogs]);

  if (!user) return <div className="min-h-screen flex items-center justify-center font-black text-amber-900 bg-[#FDFBF7]" dir="rtl">أطايب الشام ترحب بكم...</div>;

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-right pb-20" dir="rtl">
      <Sidebar view={view} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
      
      {paymentModal.isOpen && paymentModal.order && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl text-right">
            <h3 className="font-black text-xl mb-2 text-amber-900">تسجيل مبلغ محصل</h3>
            <p className="text-sm text-gray-500 mb-6 font-bold">الزبون: {paymentModal.order.customerName}</p>
            <input type="number" className="w-full p-4 border rounded-2xl mb-6 bg-gray-50 text-xl font-black text-center text-green-700 outline-none focus:ring-2 focus:ring-green-500" value={paymentModal.amount} onChange={e => setPaymentModal({...paymentModal, amount: e.target.value})} placeholder="المبلغ (ر.ع)" autoFocus />
            <div className="flex gap-3"><button onClick={savePayment} className="flex-1 bg-green-600 hover:bg-green-700 text-white p-4 rounded-2xl font-black">تأكيد الدفع</button><button onClick={() => setPaymentModal({ isOpen: false, order: null, amount: '' })} className="flex-1 bg-gray-100 py-4 rounded-2xl font-black">إلغاء</button></div>
          </div>
        </div>
      )}

      {recalcModal && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl text-right border-t-8 border-red-600 relative">
            <RefreshCcw className="text-red-600 mb-4 mx-auto animate-spin-slow" size={48} />
            <h3 className="font-black text-2xl mb-3 text-gray-800 text-center">إغلاق يومية الفرن</h3>
            <p className="text-sm text-gray-600 mb-6 font-bold text-center">سيتم مسح سجل الإنتاج الحالي واعتماد "الجاهز" كأساس للإنجاز المتبقي.</p>
            <div className="flex gap-3"><button onClick={executeRecalculation} className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-black">تأكيد التصفير</button><button onClick={() => setRecalcModal(false)} className="flex-1 bg-gray-100 py-4 rounded-2xl font-black">إلغاء</button></div>
          </div>
        </div>
      )}

      <div className="lg:pr-64 p-4 lg:p-8 max-w-7xl mx-auto">
        <header className="flex flex-wrap justify-between items-center mb-8 pt-10 lg:pt-0 gap-4">
          <div className="flex items-center gap-4"><button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 bg-amber-800 text-white rounded-xl"><ChevronRight /></button><h1 className="text-2xl font-black text-gray-800">أطايب الشام</h1></div>
          {user.uid === 'local-preview-mode' ? ( <div className="bg-yellow-50 px-4 py-2 rounded-2xl border border-yellow-200 flex items-center gap-2"><AlertTriangle size={14} className="text-yellow-600" /><span className="text-[10px] font-black text-yellow-800 uppercase hidden sm:inline">معاينة محلية (غير متصل)</span></div>) : (<div className="bg-green-50 px-4 py-2 rounded-2xl border border-green-200 flex items-center gap-2"><div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div><span className="text-[10px] font-black text-green-800 uppercase">سحابي نشط</span></div>)}
        </header>

        <main className="space-y-6">
          
          {view === 'dashboard' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <HighlightStatBox title="الصافي (شامل التغليف بعد الخصم)" val={stats.sales} colorClass="from-blue-50 to-blue-100 border-blue-300 text-blue-900" icon={DollarSign} />
                <HighlightStatBox title="المطلوب كلياً" val={totalReqKg} isCur={false} colorClass="from-amber-50 to-amber-100 border-amber-300 text-amber-900" icon={Box} />
                <HighlightStatBox title="كمية الإنجاز (الفعال)" val={totalProdKg} isCur={false} colorClass="from-green-50 to-green-100 border-green-300 text-green-900" icon={Hammer} />
                <HighlightStatBox title="الباقي للإنتاج" val={totalRemKg} isCur={false} colorClass="from-red-50 to-red-100 border-red-300 text-red-900" icon={AlertTriangle} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatBox title="الديون" val={stats.rem} color="red" />
                <StatBox title="المحصل" val={stats.paid} color="green" />
                <StatBox title="الجاهز (كجم)" val={totalReadyKg} color="amber" isCur={false} />
                <StatBox title="تغليف خاص" val={stats.packaging} color="purple" />
                <StatBox title="التوصيل" val={stats.delivery} color="blue" />
                <StatBox title="الربح الصافي" val={stats.profit} color="green" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
                    <h3 className="font-black text-gray-800 mb-6 flex items-center gap-2"><BarChart2 className="text-blue-600"/> مسار الإنتاج (آخر 7 أيام)</h3>
                    <div className="flex items-end justify-between gap-2 h-48 mt-auto pt-4 border-b pb-2">
                       {dailyChartData.sortedDates.map(date => (
                            <div key={date} className="flex-1 flex flex-col items-center justify-end h-full relative group">
                               <span className="text-[10px] font-black text-gray-500 mb-1 opacity-0 group-hover:opacity-100 absolute -top-6 bg-gray-100 px-2 py-1 rounded">{dailyChartData.grouped[date].toFixed(1)}</span>
                               <div className="w-full max-w-[40px] bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-xl" style={{height: `${(dailyChartData.grouped[date] / dailyChartData.maxVal) * 100}%`}}></div>
                               <span className="text-[9px] text-gray-400 font-bold mt-2 absolute -bottom-6">{date.slice(5).replace('-','/')}</span>
                            </div>
                       ))}
                    </div>
                 </div>
                 <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
                    <h3 className="font-black text-gray-800 mb-6 flex items-center gap-2"><TrendingUp className="text-green-600"/> نسبة الإنجاز لكل صنف</h3>
                    <div className="space-y-4 overflow-y-auto pr-2 max-h-[250px]">
                       {BASIC_ITEM_NAMES.map(n => {
                          const req = completionSummary[n]?.required || 0, prod = completionSummary[n]?.effectiveProduced || 0;
                          if(req === 0 && prod === 0) return null;
                          const pct = req > 0 ? Math.min(100, (prod / req) * 100) : 100;
                          return (
                             <div key={n} className="space-y-1.5"><div className="flex justify-between text-[11px] font-bold"><span className="text-gray-700">{n}</span><span className="text-gray-500">{prod.toFixed(1)} / {req.toFixed(1)} كجم</span></div>
                                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden"><div className={`h-full ${pct >= 100 ? 'bg-green-500' : 'bg-amber-500'}`} style={{width: `${pct}%`}}></div></div>
                             </div>
                          )
                       })}
                    </div>
                 </div>
              </div>
            </div>
          )}

          {view === 'new-order' && (
            <div className="bg-white p-6 md:p-8 rounded-[2rem] border shadow-sm space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InputGroup label="اسم الزبون" val={currentOrder.customerName} setVal={v => setCurrentOrder({...currentOrder, customerName: v})} />
                <InputGroup label="الهاتف" type="tel" val={currentOrder.phone} setVal={v => setCurrentOrder({...currentOrder, phone: v})} />
                <InputGroup label="تاريخ التسليم" type="date" val={currentOrder.deliveryDate} setVal={v => setCurrentOrder({...currentOrder, deliveryDate: v})} />
              </div>
              <InputGroup label="العنوان (المنطقة)" val={currentOrder.address} setVal={v => setCurrentOrder({...currentOrder, address: v})} />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-y py-6 border-gray-100 bg-gray-50/30 -mx-6 md:-mx-8 px-6 md:px-8">
                <div className="space-y-2 text-right">
                  <label className="text-[10px] font-bold text-gray-500 pr-1 uppercase">هل يوجد توصيل؟</label>
                  <div className="flex gap-2">
                    <button onClick={() => setCurrentOrder({...currentOrder, deliveryRequired:'yes', deliveryFee: currentOrder.deliveryFee || '2'})} className={`flex-1 p-3 rounded-xl border text-sm font-bold transition-all ${currentOrder.deliveryRequired==='yes'?'bg-blue-600 text-white shadow-md border-blue-700':'bg-white hover:bg-blue-50 text-gray-600'}`}>نعم، يوجد توصيل</button>
                    <button onClick={() => setCurrentOrder({...currentOrder, deliveryRequired:'no', deliveryFee:''})} className={`flex-1 p-3 rounded-xl border text-sm font-bold transition-all ${currentOrder.deliveryRequired==='no'?'bg-amber-800 text-white shadow-md':'bg-white hover:bg-gray-100 text-gray-600'}`}>لا (استلام)</button>
                  </div>
                </div>
                {currentOrder.deliveryRequired==='yes' && 
                  <InputGroup label="مبلغ التوصيل (ر.ع)" type="number" val={currentOrder.deliveryFee} setVal={v => setCurrentOrder({...currentOrder, deliveryFee:v})} />
                }
                <div className={currentOrder.deliveryRequired==='yes' ? "md:col-span-1" : "md:col-span-2"}>
                  <InputGroup label="ملاحظات الطلب (اختياري)" placeholder="مثال: موعد الاستلام..." val={currentOrder.notes} setVal={v => setCurrentOrder({...currentOrder, notes:v})} />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{products.map(p => (<button key={p.id} onClick={() => { const ex = currentOrder.items.find(i=>i.id===p.id); const nItems = ex ? currentOrder.items.filter(i=>i.id!==p.id) : [...currentOrder.items, {...p, quantity: 1}]; setCurrentOrder({...currentOrder, items: nItems}); }} className={`p-3 rounded-2xl border text-sm font-bold ${currentOrder.items.find(i=>i.id===p.id)?'bg-amber-100 border-amber-500':'bg-gray-50'}`}>{p.name}</button>))}</div>
              {currentOrder.items.length > 0 && (
                <div className="bg-amber-50/50 p-6 rounded-3xl space-y-4">
                  {currentOrder.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between bg-white p-3 rounded-xl shadow-sm">
                      <span className="font-bold text-sm">{it.name}</span>
                      <input type="number" step="0.5" className="w-20 text-center border rounded-lg font-black" value={it.quantity} onChange={e => setCurrentOrder({...currentOrder, items: currentOrder.items.map((x,i)=>i===idx?{...x, quantity: parseFloat(e.target.value)||0}:x)})} />
                    </div>
                  ))}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                    <InputGroup label="تغليف خاص" type="number" val={currentOrder.packagingFee} setVal={v=>setCurrentOrder({...currentOrder, packagingFee:v})} />
                    <InputGroup label="خصم" type="number" val={currentOrder.discount} setVal={v=>setCurrentOrder({...currentOrder, discount:v})} />
                    <InputGroup label="عربون" type="number" val={currentOrder.paidAmount} setVal={v=>setCurrentOrder({...currentOrder, paidAmount:v})} />
                  </div>
                  <button onClick={handleSaveOrder} className="w-full bg-amber-900 text-white py-4 rounded-2xl font-black shadow-xl mt-4">اعتماد وحفظ أطايب الشام</button>
                </div>
              )}
            </div>
          )}

          {view === 'orders' && (
            <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
              <div className="p-6 border-b bg-gray-50/50 space-y-4">
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                   <input type="text" placeholder="الاسم..." className="p-3 rounded-xl border text-sm" value={filters.name} onChange={e=>setFilters({...filters, name: e.target.value})} />
                   <input type="date" className="p-3 rounded-xl border text-sm" value={filters.date} onChange={e=>setFilters({...filters, date: e.target.value})} />
                   <select className="p-3 rounded-xl border text-sm" value={filters.product} onChange={e=>setFilters({...filters, product: e.target.value})}><option value="all">كل الأصناف</option>{products.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}</select>
                   <select className="p-3 rounded-xl border text-sm font-bold bg-amber-50" value={filters.payment} onChange={e=>setFilters({...filters, payment: e.target.value})}><option value="all">الدفع: الكل</option><option value="paid">مدفوع</option><option value="unpaid">دين</option></select>
                 </div>
                 {filters.date && dateOrderSummary && (
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mt-4 flex flex-wrap gap-4 items-center">
                       <span className="font-black text-blue-900 text-sm">مطلوبات ({formatDisplayDate(filters.date)}):</span>
                       {Object.entries(dateOrderSummary).map(([name, qty]) => ( <div key={name} className="text-xs font-bold bg-white px-3 py-1 rounded shadow-sm">{name}: <span className="text-red-600">{qty.toFixed(1)} كجم</span></div> ))}
                    </div>
                 )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right min-w-[1000px]">
                  <thead className="bg-white border-b text-[10px] text-gray-400 font-black uppercase tracking-widest"><tr><th className="p-6 w-1/4">الزبون والتفاصيل</th><th className="p-6 w-1/3">الأصناف (جاهز؟)</th><th className="p-6 text-left w-1/6">الحساب وتفاصيل المبلغ</th><th className="p-6 text-center">الحالة</th><th className="p-6"></th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredOrders.map(o => {
                      const itemsTotal = (o.items || []).reduce((s,i)=>s+((parseFloat(i.price)||0)*(parseFloat(i.quantity)||0)),0);
                      const delivFee = parseFloat(o.deliveryFee) || 0;
                      const pkgFee = parseFloat(o.packagingFee) || 0;
                      const disc = parseFloat(o.discount) || 0;
                      const totalAmount = itemsTotal + delivFee + pkgFee - disc;
                      const paid = parseFloat(o.paidAmount) || 0;
                      const remAmount = totalAmount - paid;
                      
                      const isToday = o.deliveryDate === actualTodayStr;
                      
                      return (
                      <tr key={o.id} className="hover:bg-amber-50/10 transition-colors align-top">
                        <td className="p-6">
                          <div className="font-black text-gray-800 text-sm mb-1 flex items-center gap-2">{o.customerName}<button onClick={()=>sendWhatsAppMsg(o)} className="text-green-500 bg-green-50 p-1 rounded-full"><MessageCircle size={14}/></button></div>
                          {isToday && o.status !== 'Delivered' && <span className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded animate-pulse inline-block mb-1">تسليم اليوم!</span>}
                          <div className="text-[10px] text-amber-700 font-bold mt-1"><Clock size={10} className="inline mr-1"/> {formatDisplayDate(o.deliveryDate)}</div>
                          
                          {o.address && <div className="text-[10px] text-gray-500 font-bold mt-1.5"><MapPin size={10} className="inline mr-1 text-gray-400"/> {o.address}</div>}
                          {o.deliveryRequired === 'yes' && <div className="text-[10px] text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded mt-1.5 inline-block font-bold"><Truck size={12} className="inline mr-1"/> توصيل مندوب</div>}
                          
                          {o.notes && <div className="text-[10px] text-red-500 bg-red-50 p-1.5 rounded mt-2 font-bold whitespace-pre-wrap">ملاحظة: {o.notes}</div>}
                        </td>
                        <td className="p-6 space-y-1">{(o.items||[]).map((it, idx) => {
                             const isActuallyReady = it.isReady || o.status === 'Ready' || o.status === 'Delivered';
                             return (
                             <div key={idx} className={`border px-3 py-2 rounded-lg text-[11px] font-bold flex justify-between items-center transition-colors ${isActuallyReady ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                               <div className="flex items-center gap-2"><input type="checkbox" checked={!!isActuallyReady} onChange={(e) => toggleItemReady(o, idx, e.target.checked)} disabled={o.status === 'Ready' || o.status === 'Delivered'} className="w-4 h-4 text-green-600 rounded" /><span className={isActuallyReady ? 'line-through opacity-50' : ''}>{it.name}</span></div>
                               <span className={isActuallyReady ? 'text-green-700' : 'text-amber-700'}>{it.quantity} كجم</span>
                             </div>
                           )})}</td>
                        <td className="p-6 text-left space-y-1 border-r border-gray-50">
                           <div className="text-[10px] text-gray-500 font-bold">المنتجات: {itemsTotal.toFixed(2)}</div>
                           {pkgFee > 0 && <div className="text-[10px] text-purple-600 font-bold">تغليف: +{pkgFee.toFixed(2)}</div>}
                           {delivFee > 0 && <div className="text-[10px] text-blue-600 font-bold">توصيل: +{delivFee.toFixed(2)}</div>}
                           {disc > 0 && <div className="text-[10px] text-red-500 font-bold">خصم: -{disc.toFixed(2)}</div>}
                           
                           <div className="font-black text-sm text-gray-800 border-t border-gray-100 pt-1 mt-1">النهائي: {totalAmount.toFixed(2)} ر.ع</div>
                           
                           {remAmount > 0.05 ? ( <div className="text-[10px] text-red-500 font-black bg-red-50 px-2 py-1 rounded mt-1 inline-block">آجل: {remAmount.toFixed(2)}</div> ) : ( <div className="text-[10px] text-green-600 font-black bg-green-50 px-2 py-1 rounded mt-1 inline-block">مدفوع ✓</div> )}
                        </td>
                        <td className="p-6 border-r border-gray-50 text-center"><select className={`p-2 rounded-xl text-[10px] font-black border-none shadow-sm ${ORDER_STATUSES.find(s=>s.id===o.status)?.color}`} value={o.status} onChange={(e) => handleUpdateOrderStatus(o, e.target.value)}>{ORDER_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></td>
                        <td className="p-6 text-left"><div className="flex gap-2 justify-end"><button onClick={() => { setCurrentOrder({...o}); setView('new-order'); }} className="text-blue-400"><Edit3 size={16}/></button><button onClick={() => handleDeleteOrder(o.id)} className="text-red-300"><Trash2 size={16}/></button></div></td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'ready-items' && (
            <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
               <div className="p-6 border-b bg-green-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                 <div><h2 className="font-black text-green-900 text-xl flex items-center gap-2"><ListChecks size={24}/> لوحة تعبئة أطايب الشام</h2><p className="text-xs text-green-700 mt-1 font-bold">متابعة الكميات الجاهزة وغير الجاهزة بالطلبات.</p></div>
                 <div className="bg-white px-4 py-2 rounded-xl border border-green-200 shadow-sm text-center"><span className="text-[10px] text-gray-500 font-bold block">إجمالي المعبأ:</span><span className="font-black text-xl text-green-700">{totalReadyKg.toFixed(2)} كجم</span></div>
               </div>
               <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-gray-50/30">
                  {INITIAL_PRODUCTS.map(p => {
                     const d = readyItemsDetails[p.name]; if (!d || d.req === 0) return null;
                     const notReady = Math.max(0, d.req - d.ready);
                     return (
                        <div key={p.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                           <h3 className="font-black text-gray-800 text-lg mb-4">{p.name}</h3>
                           <div className="space-y-2 text-sm"><div className="flex justify-between"><span>مطلوب:</span> <b className="text-gray-700">{d.req.toFixed(2)}</b></div><div className="flex justify-between text-green-600 border-t pt-2"><span>جاهز (معبأ):</span> <b>{d.ready.toFixed(2)}</b></div><div className="flex justify-between text-red-500 border-t pt-2 font-black"><span>باقي للتعبئة:</span> <b>{notReady.toFixed(2)}</b></div></div>
                        </div>
                     )
                  })}
               </div>
            </div>
          )}

          {/* التعديل: إظهار الفائض في إحصائيات الإنجاز */}
          {view === 'production-stats' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-3xl border shadow-sm">
                 <div className="flex bg-amber-800 text-white rounded-xl p-1 text-sm font-bold px-4 py-2 shadow-md">الإنجاز الفعال = الجاهز + المخبوز</div>
                 <button onClick={() => setRecalcModal(true)} className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-6 py-3 rounded-xl font-black transition-all flex items-center gap-2 shadow-sm"><RefreshCcw size={18} /> إغلاق يومية الفرن</button>
              </div>
              <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
                <table className="w-full text-right"><thead className="bg-white border-b text-[10px] text-gray-400 font-black uppercase"><tr><th className="p-6">الصنف</th><th className="p-6 text-center">مطلوب</th><th className="p-6 text-center text-blue-800 bg-blue-50/30">الإنجاز (كجم / حبة)</th><th className="p-6 text-center bg-red-50/30">الباقي / الفائض</th></tr></thead>
                  <tbody className="divide-y divide-gray-50 text-sm font-bold">
                    {BASIC_ITEM_NAMES.map(n => {
                      const d = completionSummary[n]; const pData = products.find(x=>x.name===n); const ppk = pData?.piecesPerKg || (n.includes('غريبة')?50:40);
                      const remKg = Math.max(0, d.required - d.effectiveProduced);
                      const surplusKg = Math.max(0, d.effectiveProduced - d.required); // حساب الفائض
                      return (
                        <tr key={n} className="hover:bg-amber-50/20">
                          <td className="p-6">{n}</td><td className="p-6 text-center text-gray-600">{d.required.toFixed(2)}</td>
                          <td className="p-6 text-center bg-blue-50/10"><div className="font-black text-blue-700">{d.effectiveProduced.toFixed(2)}</div><div className="text-[10px] text-blue-400">({Math.ceil(d.effectiveProduced*ppk)} حبة)</div></td>
                          <td className="p-6 text-center">
                              {remKg > 0 ? (
                                  <div className="bg-red-100 text-red-700 px-3 py-1 rounded-lg inline-block"> {remKg.toFixed(2)} كجم <span className="text-[10px] block">({Math.ceil(remKg*ppk)} حبة)</span></div>
                              ) : surplusKg > 0 ? (
                                  <div className="bg-green-100 text-green-700 px-3 py-1 rounded-lg inline-block border border-green-300"> <span className="text-[10px] block mb-0.5">فائض زائد:</span> {surplusKg.toFixed(2)} كجم <span className="text-[10px] block">({Math.floor(surplusKg*ppk)} حبة)</span></div>
                              ) : (
                                  <span className="text-green-600">مكتمل تماماً ✓</span>
                              )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'expected-materials' && (
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-3xl border shadow-sm">
                <h2 className="font-black text-gray-800 text-lg mb-6 text-center">محاكاة توقعات الموسم</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {EXPECTED_ITEM_NAMES.map(n => <InputGroup key={n} label={`${n} (كجم)`} type="number" val={expectedQty[n]} setVal={v => setExpectedQty({...expectedQty, [n]: v})} />)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 border-t pt-8">
                   <div className="bg-amber-50 p-6 rounded-3xl text-center"><span className="text-sm font-bold text-amber-800 block mb-2">عجنات المعمول المتوقعة:</span><div className="text-3xl font-black text-amber-900">{expectedBOM.maamoulBatches.toFixed(1)}</div></div>
                   <div className="bg-blue-50 p-6 rounded-3xl text-center"><span className="text-sm font-bold text-blue-800 block mb-2">عجنات الغريبة المتوقعة:</span><div className="text-3xl font-black text-blue-900">{expectedBOM.ghorBatches.toFixed(1)}</div></div>
                </div>
              </div>
              <div className="bg-white rounded-3xl border p-8 shadow-sm overflow-hidden text-right">
                <h3 className="font-black text-gray-800 mb-6 underline decoration-green-200 text-lg">قائمة المشتريات بالعبوات التجارية</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <UnitMaterialStat name="طحين" val={expectedBOM.raw.flour} defaultUnit="كجم" unitStr={calculateCommercialUnits('flour', expectedBOM.raw.flour)} />
                  <UnitMaterialStat name="سكر بودرة" val={expectedBOM.raw.sugar} defaultUnit="كجم" unitStr={calculateCommercialUnits('sugar', expectedBOM.raw.sugar)} />
                  <UnitMaterialStat name="سمن أصيل" val={expectedBOM.raw.aseel} defaultUnit="كجم" unitStr={calculateCommercialUnits('aseel', expectedBOM.raw.aseel)} />
                  <UnitMaterialStat name="سمن مراعي" val={expectedBOM.raw.marai} defaultUnit="كجم" unitStr={calculateCommercialUnits('marai', expectedBOM.raw.marai)} />
                  <UnitMaterialStat name="ماء زهر" val={expectedBOM.raw.mazahr} defaultUnit="لتر" unitStr={calculateCommercialUnits('mazahr', expectedBOM.raw.mazahr)} />
                  <MaterialStat name="تمر" val={expectedBOM.raw.tamer} unit="كجم" />
                  <MaterialStat name="جوز" val={expectedBOM.raw.jowz} unit="كجم" />
                  <MaterialStat name="فستق" val={expectedBOM.raw.fistq} unit="كجم" />
                </div>
              </div>
            </div>
          )}

          {view === 'materials' && (
            <div className="space-y-6 text-right">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-amber-50 p-8 rounded-3xl border border-amber-200 shadow-sm relative overflow-hidden">
                  <h3 className="font-black text-amber-900 mb-4 flex items-center justify-end gap-2">عجنات المعمول <ChefHat size={20}/></h3>
                  <div className="space-y-2 text-sm bg-white/50 p-4 rounded-2xl">
                    <div className="flex justify-between"><span>عجنات مطلوبة للطلبات:</span> <b>{materialsBOM.maamoul.req.toFixed(2)}</b></div>
                    <div className="flex justify-between items-center border-t pt-2 mt-2">
                      <span className="text-green-700 font-bold">منجز كعجين فعلاً:</span>
                      <input type="number" step="1" className="w-20 p-2 text-center border rounded-lg font-black text-green-800 bg-white" value={doughInventory.maamoul || ''} onChange={(e) => handleUpdateDough('maamoul', e.target.value)} />
                    </div>
                    <div className="flex justify-between border-t pt-2 font-black">
                      {(materialsBOM.maamoul.req - (doughInventory.maamoul||0)) > 0 ? (
                         <><span className="text-red-600">الباقي للعجن:</span> <b className="text-red-600">{(materialsBOM.maamoul.req - (doughInventory.maamoul||0)).toFixed(2)} عجنة</b></>
                      ) : (
                         <><span className="text-green-600">فائض عجين (زائد):</span> <b className="text-green-600">{Math.abs(materialsBOM.maamoul.req - (doughInventory.maamoul||0)).toFixed(2)} عجنة</b></>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-blue-50 p-8 rounded-3xl border border-blue-200 shadow-sm relative overflow-hidden">
                  <h3 className="font-black text-blue-900 mb-4 flex items-center justify-end gap-2">عجنات الغريبة <ChefHat size={20}/></h3>
                  <div className="space-y-2 text-sm bg-white/50 p-4 rounded-2xl">
                    <div className="flex justify-between"><span>عجنات مطلوبة للطلبات:</span> <b>{materialsBOM.ghor.req.toFixed(2)}</b></div>
                    <div className="flex justify-between items-center border-t pt-2 mt-2">
                      <span className="text-green-700 font-bold">منجز كعجين فعلاً:</span>
                      <input type="number" step="1" className="w-20 p-2 text-center border rounded-lg font-black text-green-800 bg-white" value={doughInventory.ghorayeba || ''} onChange={(e) => handleUpdateDough('ghorayeba', e.target.value)} />
                    </div>
                    <div className="flex justify-between border-t pt-2 font-black">
                      {(materialsBOM.ghor.req - (doughInventory.ghorayeba||0)) > 0 ? (
                         <><span className="text-red-600">الباقي للعجن:</span> <b className="text-red-600">{(materialsBOM.ghor.req - (doughInventory.ghorayeba||0)).toFixed(2)} عجنة</b></>
                      ) : (
                         <><span className="text-green-600">فائض عجين (زائد):</span> <b className="text-green-600">{Math.abs(materialsBOM.ghor.req - (doughInventory.ghorayeba||0)).toFixed(2)} عجنة</b></>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-3xl border p-8 shadow-sm">
                <h3 className="font-black text-gray-800 mb-6 underline decoration-amber-200 text-lg">المواد الخام المطلوبة (لتغطية الباقي)</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <MaterialStat name="طحين" val={materialsBOM.raw.flour} unit="كجم" />
                  <MaterialStat name="سميد" val={materialsBOM.raw.semolina} unit="كجم" />
                  <MaterialStat name="سكر بودرة" val={materialsBOM.raw.sugar} unit="كجم" />
                  <MaterialStat name="سمن أصيل" val={materialsBOM.raw.aseel} unit="كجم" />
                  <MaterialStat name="سمن مراعي" val={materialsBOM.raw.marai} unit="كجم" />
                  <MaterialStat name="ماء زهر" val={materialsBOM.raw.mazahr} unit="لتر" />
                  <MaterialStat name="محلب" val={materialsBOM.raw.mahlab} unit="كجم" />
                  <MaterialStat name="تمر" val={materialsBOM.raw.tamer} unit="كجم" />
                  <MaterialStat name="جوز" val={materialsBOM.raw.jowz} unit="كجم" />
                  <MaterialStat name="فستق" val={materialsBOM.raw.fistq} unit="كجم" />
                </div>
              </div>
            </div>
          )}

          {view === 'production-log' && (
              <div className="max-w-2xl mx-auto space-y-6 text-right">
                <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-4">
                    <h3 className="font-black text-gray-700">تسجيل ما خرج من الفرن اليوم</h3>
                    <div className="flex gap-2 bg-gray-50 p-2 rounded-xl w-fit">
                      <button onClick={()=>setProdEntry({...prodEntry,inputType:'kg'})} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${prodEntry.inputType==='kg'?'bg-amber-800 text-white shadow-md':'text-gray-500 hover:bg-gray-200'}`}>بالكيلو</button>
                      <button onClick={()=>setProdEntry({...prodEntry,inputType:'pieces'})} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${prodEntry.inputType==='pieces'?'bg-amber-800 text-white shadow-md':'text-gray-500 hover:bg-gray-200'}`}>بالعدد (حبات)</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <select className="p-4 bg-gray-50 border rounded-2xl outline-none text-sm text-right" value={prodEntry.productId} onChange={e=>setProdEntry({...prodEntry,productId:e.target.value})}><option value="">-- اختر الصنف --</option>{products.filter(p=>BASIC_ITEM_NAMES.includes(p.name)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
                        <InputGroup label={prodEntry.inputType==='kg'?'الكمية بالكيلو':'العدد (حبات)'} val={prodEntry.quantity} setVal={v=>setProdEntry({...prodEntry,quantity:v})} type="number" />
                    </div>
                    <button onClick={handleSaveLog} disabled={!prodEntry.productId || !prodEntry.quantity} className="w-full bg-amber-900 text-white py-4 rounded-2xl font-black disabled:opacity-50">حفظ المخبوز</button>
                </div>
                <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                    <div className="p-6 border-b bg-gray-50 flex justify-between items-center"><h2 className="font-black text-gray-700 text-sm">سجل إنجاز اليوم: {dailyTotalKg.toFixed(2)} كجم</h2></div>
                    <table className="w-full text-right text-xs"><tbody className="divide-y divide-gray-100">{productionLogs.map(l=>(<tr key={l.id} className="hover:bg-amber-50/5"><td className="p-4 text-gray-400">{formatDisplayDate(l.date)}</td><td className="p-4 font-bold">{l.productName}</td><td className="p-4 font-black text-amber-800">{Number(l.quantity||0).toFixed(2)} كجم</td><td className="p-4 text-left"><button onClick={()=>handleDeleteLog(l.id)} className="text-red-300 ml-4"><Trash2 size={14}/></button></td></tr>))}</tbody></table>
                </div>
              </div>
          )}

          {view === 'expenses' && (
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="bg-white p-8 rounded-3xl border shadow-md">
                <h3 className="font-black text-gray-800 mb-6 flex items-center gap-2 text-right"><Receipt className="text-red-600"/> تسجيل فاتورة شراء</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                   
                   <div className="space-y-1 text-right w-full">
                     <label className="text-[10px] font-bold text-gray-500 pr-1 uppercase">المادة (اختر أو اكتب)</label>
                     <input list="expense-items" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 text-sm font-bold" value={newExpense.description} onChange={e=>setNewExpense({...newExpense, description:e.target.value})} placeholder="مثال: طحين.." />
                     <datalist id="expense-items">{allPurchaseTargets.map(t=><option key={t.name} value={t.name}/>)}</datalist>
                   </div>

                   <div className="space-y-1 text-right w-full">
                     <label className="text-[10px] font-bold text-gray-500 pr-1 uppercase">الوحدة</label>
                     <select className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm text-right font-bold" value={newExpense.unit} onChange={e=>setNewExpense({...newExpense, unit:e.target.value})}><option value="">اختر الوحدة</option>{UNITS_LIST.map(u=><option key={u} value={u}>{u}</option>)}</select>
                   </div>
                   
                   <InputGroup label="الكمية" type="number" val={newExpense.quantity} setVal={v=>setNewExpense({...newExpense, quantity:v})} />
                   <InputGroup label="سعر الوحدة" type="number" val={newExpense.unitPrice} setVal={v=>setNewExpense({...newExpense, unitPrice:v})} />
                </div>
                <button onClick={handleSaveExpense} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black mt-6">حفظ الفاتورة</button>
              </div>

              <div className="bg-white rounded-3xl border shadow-sm overflow-hidden mt-6">
                <div className="p-6 border-b bg-blue-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h2 className="font-black text-blue-900 text-lg flex items-center gap-2"><ShoppingBag size={20}/> النواقص والمخزون الموحد بالوحدة القياسية</h2>
                    <p className="text-xs text-gray-500 mt-1">يتم تحويل الشراء بالعبوات التجارية آلياً لسهولة الجرد.</p>
                  </div>
                  
                  <div className="flex bg-white p-1 rounded-xl border items-center shadow-sm w-full md:w-auto">
                    <input type="text" placeholder="مادة أخرى.." className="p-2 outline-none text-xs w-20 bg-transparent font-bold" value={newTarget.name} onChange={e=>setNewTarget({...newTarget, name: e.target.value})} />
                    <input type="number" placeholder="مطلوب" className="p-2 outline-none text-xs w-14 bg-transparent border-r font-bold text-center" title="الكمية المطلوبة" value={newTarget.target} onChange={e=>setNewTarget({...newTarget, target: e.target.value})} />
                    <input type="number" placeholder="موجود" className="p-2 outline-none text-xs w-14 bg-transparent border-r font-bold text-center" title="الموجود مسبقاً" value={newTarget.existing} onChange={e=>setNewTarget({...newTarget, existing: e.target.value})} />
                    <input type="text" placeholder="الوحدة" className="p-2 outline-none text-xs w-14 bg-transparent border-r font-bold text-center" value={newTarget.unit} onChange={e=>setNewTarget({...newTarget, unit: e.target.value})} />
                    <button onClick={addCustomInventoryItem} className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg ml-1 transition-colors"><Plus size={16}/></button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-white border-b text-[10px] text-gray-400 font-black uppercase">
                      <tr>
                        <th className="p-4 w-1/4">المادة</th>
                        <th className="p-4 text-center">مطلوب للإنتاج</th>
                        <th className="p-4 text-center border-x bg-gray-50/50">موجود مسبقاً</th>
                        <th className="p-4 text-center text-green-600">تم شراؤه (يحول آلياً)</th>
                        <th className="p-4 text-center text-red-500 border-r bg-red-50/20">الباقي لشرائه</th>
                        <th className="p-4 text-center text-amber-500 bg-amber-50/20">زيادة (فائض)</th>
                        <th className="p-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {allPurchaseTargets.filter(t => t.required > 0 || t.purchased > 0 || t.existing > 0 || !t.isBasic).map((t, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/10 transition-colors">
                          <td className="p-4 font-bold text-gray-800 flex items-center gap-2">
                             {t.name} {t.isBasic && <span className="bg-gray-100 text-gray-400 text-[9px] px-2 py-0.5 rounded">أساسي</span>}
                          </td>
                          <td className="p-4 text-center text-gray-500 font-bold">{t.required.toFixed(2)} <span className="text-[10px]">{t.unit}</span></td>
                          
                          <td className="p-4 text-center border-x bg-gray-50/50">
                             <input type="number" step="any" className="w-16 p-1 text-center border rounded-lg font-black outline-none focus:border-blue-500" value={t.existing || ''} onChange={(e) => t.isBasic ? updateBasicExisting(t.key, e.target.value) : updateCustomItemExisting(t.id, e.target.value)} placeholder="0" />
                          </td>

                          <td className="p-4 text-center text-green-600 font-bold">{t.purchased.toFixed(2)} <span className="text-[10px]">{t.unit}</span></td>
                          
                          <td className="p-4 text-center border-r bg-red-50/10">
                             {t.remainingToBuy > 0 ? (
                               <div className="flex flex-col items-center">
                                 <span className="font-black text-red-600 bg-red-100 px-3 py-1 rounded-lg">{t.remainingToBuy.toFixed(2)} <span className="text-[10px]">{t.unit}</span></span>
                                 {t.isBasic && calculateCommercialUnits(t.key, t.remainingToBuy) !== "-" && (
                                    <span className="text-[9px] text-red-500 font-bold mt-1.5">{calculateCommercialUnits(t.key, t.remainingToBuy)}</span>
                                 )}
                               </div>
                             ) : (
                               <span className="text-green-600 text-xs font-black">-</span>
                             )}
                          </td>

                          <td className="p-4 text-center bg-amber-50/10">
                             {t.surplus > 0 ? (
                               <span className="font-black text-amber-700 bg-amber-100 px-3 py-1 rounded-lg">+{t.surplus.toFixed(2)} <span className="text-[10px]">{t.unit}</span></span>
                             ) : (
                               <span className="text-gray-300 text-xs font-black">-</span>
                             )}
                          </td>

                          <td className="p-4 text-left">
                            {!t.isBasic && <button onClick={() => deleteCustomInventoryItem(t.id)} className="text-red-300 hover:text-red-500 bg-red-50 p-1.5 rounded-lg transition-all"><Trash2 size={14}/></button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
                  <h2 className="font-black text-gray-700 text-sm">سجل الفواتير المدفوعة</h2>
                  <span className="bg-red-100 text-red-800 px-3 py-1 rounded-lg font-black text-xs">المنصرف الكلي: {expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0).toFixed(2)} ر.ع</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-white border-b text-[10px] text-gray-400 font-black uppercase">
                      <tr><th className="p-4">التاريخ</th><th className="p-4">البيان</th><th className="p-4 text-center">الكمية والوحدة</th><th className="p-4 text-center">سعر الوحدة</th><th className="p-4 text-center font-bold">الإجمالي</th><th className="p-4"></th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {expenses.sort((a,b) => b.id - a.id).map(e=>(
                        <tr key={e.id} className="hover:bg-red-50/10">
                          <td className="p-4 text-xs text-gray-500 font-mono" dir="ltr">{formatDisplayDate(e.date)}</td>
                          <td className="p-4 font-bold text-gray-800">{e.description}</td>
                          <td className="p-4 text-center text-gray-600 font-bold">{e.quantity} <span className="text-[10px]">{e.unit}</span></td>
                          <td className="p-4 text-center text-gray-500">{Number(e.unitPrice || 0).toFixed(2)}</td>
                          <td className="p-4 text-center font-black text-red-700 bg-red-50/30">{Number(e.amount).toFixed(2)} ر.ع</td>
                          <td className="p-4 text-left"><button onClick={() => handleDeleteExpense(e.id)} className="text-red-300 hover:text-red-500 bg-red-50 p-2 rounded-lg transition-all"><Trash2 size={16}/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* التعديل: إصلاح فلتر وجدول الديون والمدفوعات لتجنب أخطاء الكسور العشرية */}
          {view === 'payments' && (
            <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden max-w-5xl mx-auto">
               <div className="p-6 border-b bg-red-50/50 flex items-center justify-between">
                 <h2 className="font-black text-red-800 text-lg flex items-center gap-2"><DollarSign/> سجل الديون والمدفوعات الآجلة</h2>
               </div>
               <table className="w-full text-right text-sm">
                 <thead className="bg-white border-b text-[10px] text-gray-400 font-black uppercase">
                   <tr><th className="p-6">الزبون</th><th className="p-6">التاريخ</th><th className="p-6 text-center">الإجمالي الكلي (بعد الخصم)</th><th className="p-6 text-center">المدفوع (عربون)</th><th className="p-6 text-center">المتبقي (الديون)</th><th className="p-6"></th></tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                   {orders.filter(o => {
                      const itemsTotal = (o.items || []).reduce((s, i) => s + ((parseFloat(i.price) || 0) * (parseFloat(i.quantity) || 0)), 0);
                      const tot = itemsTotal + (parseFloat(o.deliveryFee) || 0) + (parseFloat(o.packagingFee) || 0) - (parseFloat(o.discount) || 0);
                      const paid = parseFloat(o.paidAmount) || 0;
                      return (tot - paid) > 0.05; // فلترة صارمة وتجاوز للكسور
                   }).sort((a,b) => parseInt(b.id) - parseInt(a.id)).map(o => {
                      const itemsTotal = (o.items || []).reduce((s, i) => s + ((parseFloat(i.price) || 0) * (parseFloat(i.quantity) || 0)), 0);
                      const tot = itemsTotal + (parseFloat(o.deliveryFee) || 0) + (parseFloat(o.packagingFee) || 0) - (parseFloat(o.discount) || 0);
                      const paid = parseFloat(o.paidAmount) || 0;
                      const rem = tot - paid;
                      return (
                        <tr key={o.id} className="hover:bg-red-50/30 transition-colors">
                          <td className="p-6 font-bold text-gray-800">{o.customerName}</td>
                          <td className="p-6 text-gray-500 font-mono text-xs" dir="ltr">{formatDisplayDate(o.deliveryDate)}</td>
                          <td className="p-6 text-center font-bold text-gray-700">{tot.toFixed(2)}</td>
                          <td className="p-6 text-center text-green-600 font-bold">{paid.toFixed(2)}</td>
                          <td className="p-6 text-center font-black text-red-600 bg-red-50">{rem.toFixed(2)}</td>
                          <td className="p-6 text-left">
                            <button onClick={() => setPaymentModal({ isOpen: true, order: o, amount: rem })} className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1.5 rounded-lg text-xs font-black transition-all shadow-sm">تسديد الدفعة</button>
                          </td>
                        </tr>
                      )
                   })}
                 </tbody>
               </table>
            </div>
          )}

          {view === 'products' && (
             <div className="bg-white p-8 rounded-3xl border shadow-sm max-w-3xl mx-auto text-right">
                <h2 className="font-black text-gray-800 text-lg mb-6 border-b pb-4">إعدادات الأصناف والأسعار</h2>
                <div className="space-y-3">
                   {products.map(p => (
                      <div key={p.id} className="grid grid-cols-12 items-center gap-4 p-4 bg-gray-50 rounded-2xl border">
                         <span className="col-span-5 font-bold text-sm text-gray-800">{p.name}</span>
                         <div className="col-span-3"><input type="number" step="0.5" className="w-full p-2 text-center border rounded-xl font-black" value={p.price} onChange={(e) => handleUpdateProduct(p, 'price', e.target.value)} /></div>
                         <div className="col-span-4 flex items-center gap-2"><input type="number" step="1" className="w-full p-2 text-center border rounded-xl font-bold" value={p.piecesPerKg || ''} onChange={(e) => handleUpdateProduct(p, 'piecesPerKg', e.target.value)} placeholder="مثال: 40" /><span className="text-[10px] text-gray-400">حبة</span></div>
                      </div>
                   ))}
                </div>
             </div>
          )}

        </main>
      </div>

      <button onClick={() => { setCurrentOrder({id: null, customerName: '', phone: '', address: '', deliveryRequired: 'no', deliveryFee: '', packagingFee: '', discount: '', notes: '', items: [], paidAmount: 0, status: 'NotReady', deliveryDate: DEFAULT_DATE}); setView('new-order'); }} className="fixed bottom-8 left-8 lg:hidden w-16 h-16 bg-amber-900 text-white rounded-3xl shadow-2xl flex items-center justify-center z-50 transition-transform active:scale-90">
        <Plus size={32} />
      </button>
    </div>
  );
}