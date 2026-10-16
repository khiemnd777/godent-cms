'use strict';

// Review-only UI: synthetic data and in-memory interactions; no API or persistent storage.
// SVG nodes copied from the preinstalled official lucide v1.8.0 package.
// ISC and Feather-derived MIT notices: LUCIDE-LICENSE.txt. No CDN or runtime package.
const lucideIcons = {
  "grid": {
    "name": "LayoutDashboard",
    "nodes": [
      [
        "rect",
        {
          "width": "7",
          "height": "9",
          "x": "3",
          "y": "3",
          "rx": "1"
        }
      ],
      [
        "rect",
        {
          "width": "7",
          "height": "5",
          "x": "14",
          "y": "3",
          "rx": "1"
        }
      ],
      [
        "rect",
        {
          "width": "7",
          "height": "9",
          "x": "14",
          "y": "12",
          "rx": "1"
        }
      ],
      [
        "rect",
        {
          "width": "7",
          "height": "5",
          "x": "3",
          "y": "16",
          "rx": "1"
        }
      ]
    ]
  },
  "clinic": {
    "name": "Hospital",
    "nodes": [
      [
        "path",
        {
          "d": "M12 7v4"
        }
      ],
      [
        "path",
        {
          "d": "M14 21v-3a2 2 0 0 0-4 0v3"
        }
      ],
      [
        "path",
        {
          "d": "M14 9h-4"
        }
      ],
      [
        "path",
        {
          "d": "M18 11h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2"
        }
      ],
      [
        "path",
        {
          "d": "M18 21V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16"
        }
      ]
    ]
  },
  "doc": {
    "name": "FileText",
    "nodes": [
      [
        "path",
        {
          "d": "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"
        }
      ],
      [
        "path",
        {
          "d": "M14 2v5a1 1 0 0 0 1 1h5"
        }
      ],
      [
        "path",
        {
          "d": "M10 9H8"
        }
      ],
      [
        "path",
        {
          "d": "M16 13H8"
        }
      ],
      [
        "path",
        {
          "d": "M16 17H8"
        }
      ]
    ]
  },
  "layers": {
    "name": "Layers",
    "nodes": [
      [
        "path",
        {
          "d": "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"
        }
      ],
      [
        "path",
        {
          "d": "M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"
        }
      ],
      [
        "path",
        {
          "d": "M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"
        }
      ]
    ]
  },
  "image": {
    "name": "Image",
    "nodes": [
      [
        "rect",
        {
          "width": "18",
          "height": "18",
          "x": "3",
          "y": "3",
          "rx": "2",
          "ry": "2"
        }
      ],
      [
        "circle",
        {
          "cx": "9",
          "cy": "9",
          "r": "2"
        }
      ],
      [
        "path",
        {
          "d": "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"
        }
      ]
    ]
  },
  "chat": {
    "name": "MessageSquare",
    "nodes": [
      [
        "path",
        {
          "d": "M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"
        }
      ]
    ]
  },
  "settings": {
    "name": "Settings",
    "nodes": [
      [
        "path",
        {
          "d": "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"
        }
      ],
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "3"
        }
      ]
    ]
  },
  "users": {
    "name": "Users",
    "nodes": [
      [
        "path",
        {
          "d": "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        }
      ],
      [
        "path",
        {
          "d": "M16 3.128a4 4 0 0 1 0 7.744"
        }
      ],
      [
        "path",
        {
          "d": "M22 21v-2a4 4 0 0 0-3-3.87"
        }
      ],
      [
        "circle",
        {
          "cx": "9",
          "cy": "7",
          "r": "4"
        }
      ]
    ]
  },
  "history": {
    "name": "History",
    "nodes": [
      [
        "path",
        {
          "d": "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
        }
      ],
      [
        "path",
        {
          "d": "M3 3v5h5"
        }
      ],
      [
        "path",
        {
          "d": "M12 7v5l4 2"
        }
      ]
    ]
  },
  "arrow": {
    "name": "ArrowRight",
    "nodes": [
      [
        "path",
        {
          "d": "M5 12h14"
        }
      ],
      [
        "path",
        {
          "d": "m12 5 7 7-7 7"
        }
      ]
    ]
  },
  "external": {
    "name": "ExternalLink",
    "nodes": [
      [
        "path",
        {
          "d": "M15 3h6v6"
        }
      ],
      [
        "path",
        {
          "d": "M10 14 21 3"
        }
      ],
      [
        "path",
        {
          "d": "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
        }
      ]
    ]
  },
  "chevron": {
    "name": "ChevronRight",
    "nodes": [
      [
        "path",
        {
          "d": "m9 18 6-6-6-6"
        }
      ]
    ]
  },
  "search": {
    "name": "Search",
    "nodes": [
      [
        "path",
        {
          "d": "m21 21-4.34-4.34"
        }
      ],
      [
        "circle",
        {
          "cx": "11",
          "cy": "11",
          "r": "8"
        }
      ]
    ]
  },
  "plus": {
    "name": "Plus",
    "nodes": [
      [
        "path",
        {
          "d": "M5 12h14"
        }
      ],
      [
        "path",
        {
          "d": "M12 5v14"
        }
      ]
    ]
  },
  "check": {
    "name": "Check",
    "nodes": [
      [
        "path",
        {
          "d": "M20 6 9 17l-5-5"
        }
      ]
    ]
  },
  "clock": {
    "name": "Clock",
    "nodes": [
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "10"
        }
      ],
      [
        "path",
        {
          "d": "M12 6v6l4 2"
        }
      ]
    ]
  },
  "info": {
    "name": "Info",
    "nodes": [
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "10"
        }
      ],
      [
        "path",
        {
          "d": "M12 16v-4"
        }
      ],
      [
        "path",
        {
          "d": "M12 8h.01"
        }
      ]
    ]
  },
  "globe": {
    "name": "Globe",
    "nodes": [
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "10"
        }
      ],
      [
        "path",
        {
          "d": "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"
        }
      ],
      [
        "path",
        {
          "d": "M2 12h20"
        }
      ]
    ]
  },
  "shield": {
    "name": "ShieldCheck",
    "nodes": [
      [
        "path",
        {
          "d": "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
        }
      ],
      [
        "path",
        {
          "d": "m9 12 2 2 4-4"
        }
      ]
    ]
  },
  "phone": {
    "name": "Phone",
    "nodes": [
      [
        "path",
        {
          "d": "M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"
        }
      ]
    ]
  },
  "mail": {
    "name": "Mail",
    "nodes": [
      [
        "path",
        {
          "d": "m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"
        }
      ],
      [
        "rect",
        {
          "x": "2",
          "y": "4",
          "width": "20",
          "height": "16",
          "rx": "2"
        }
      ]
    ]
  },
  "menu": {
    "name": "Menu",
    "nodes": [
      [
        "path",
        {
          "d": "M4 5h16"
        }
      ],
      [
        "path",
        {
          "d": "M4 12h16"
        }
      ],
      [
        "path",
        {
          "d": "M4 19h16"
        }
      ]
    ]
  },
  "close": {
    "name": "X",
    "nodes": [
      [
        "path",
        {
          "d": "M18 6 6 18"
        }
      ],
      [
        "path",
        {
          "d": "m6 6 12 12"
        }
      ]
    ]
  },
  "back": {
    "name": "ArrowLeft",
    "nodes": [
      [
        "path",
        {
          "d": "m12 19-7-7 7-7"
        }
      ],
      [
        "path",
        {
          "d": "M19 12H5"
        }
      ]
    ]
  },
  "eye": {
    "name": "Eye",
    "nodes": [
      [
        "path",
        {
          "d": "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
        }
      ],
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "3"
        }
      ]
    ]
  },
  "leaf": {
    "name": "Leaf",
    "nodes": [
      [
        "path",
        {
          "d": "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"
        }
      ],
      [
        "path",
        {
          "d": "M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"
        }
      ]
    ]
  },
  "smile": {
    "name": "Smile",
    "nodes": [
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "10"
        }
      ],
      [
        "path",
        {
          "d": "M8 14s1.5 2 4 2 4-2 4-2"
        }
      ],
      [
        "line",
        {
          "x1": "9",
          "x2": "9.01",
          "y1": "9",
          "y2": "9"
        }
      ],
      [
        "line",
        {
          "x1": "15",
          "x2": "15.01",
          "y1": "9",
          "y2": "9"
        }
      ]
    ]
  },
  "chevronDown": {
    "name": "ChevronDown",
    "nodes": [
      [
        "path",
        {
          "d": "m6 9 6 6 6-6"
        }
      ]
    ]
  },
  "chevronLeft": {
    "name": "ChevronLeft",
    "nodes": [
      [
        "path",
        {
          "d": "m15 18-6-6 6-6"
        }
      ]
    ]
  },
  "list": {
    "name": "List",
    "nodes": [
      [
        "path",
        {
          "d": "M3 5h.01"
        }
      ],
      [
        "path",
        {
          "d": "M3 12h.01"
        }
      ],
      [
        "path",
        {
          "d": "M3 19h.01"
        }
      ],
      [
        "path",
        {
          "d": "M8 5h13"
        }
      ],
      [
        "path",
        {
          "d": "M8 12h13"
        }
      ],
      [
        "path",
        {
          "d": "M8 19h13"
        }
      ]
    ]
  },
  "heading": {
    "name": "Heading2",
    "nodes": [
      [
        "path",
        {
          "d": "M4 12h8"
        }
      ],
      [
        "path",
        {
          "d": "M4 18V6"
        }
      ],
      [
        "path",
        {
          "d": "M12 18V6"
        }
      ],
      [
        "path",
        {
          "d": "M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"
        }
      ]
    ]
  }
};
function icon(name,size=18){
 const entry=lucideIcons[name];
 if(!entry)throw new Error('Unknown Lucide icon: '+name);
 const kebab=entry.name.replace(/([a-z0-9])([A-Z])/g,'$1-$2').toLowerCase();
 const nodes=entry.nodes.map(([tag,attrs])=>`<${tag} ${Object.entries(attrs).map(([key,value])=>`${key}="${escapeHTML(value)}"`).join(' ')}/>`).join('');
 return `<svg class="lucide lucide-${kebab}" data-lucide="${kebab}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${nodes}</svg>`;
}
const escapeHTML = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const badge = (label,color='green',dot=false) => `<span class="tag ${color}">${dot?'<span class="dot"></span>':''}${escapeHTML(label)}</span>`;
const navLink = (label,name,target,active=false,count='') => `<button class="nav-item ${active?'active':''}" ${target?`data-go="${target}"`:'data-unavailable="true"'} ${active?'aria-current="page"':''}>${icon(name,17)}<span>${label}</span>${count?`<span class="nav-count">${count}</span>`:''}</button>`;
const query = new URLSearchParams(location.search);
const screens = ['platform','overview','editor','leads'];
let screen = screens.includes(query.get('screen'))?query.get('screen'):'overview';
let reviewState = query.get('state')||'normal';
let selectedLead=1,toastTimer,returnFocus;
let draftDirty=false,editorTab='content',version=3;
const initialService={title:'Chăm sóc răng định kỳ',summary:'Chủ động chăm sóc nụ cười với hướng dẫn phù hợp từ đội ngũ nha khoa.',body:'Một nụ cười khỏe mạnh bắt đầu từ những thói quen nhỏ mỗi ngày. Khám răng định kỳ giúp bạn hiểu rõ tình trạng răng miệng và lựa chọn cách chăm sóc phù hợp.\n\nQuy trình chăm sóc tại Mộc An\n\n• Trao đổi nhu cầu và thói quen chăm sóc răng miệng.\n• Thăm khám và tư vấn trực tiếp với bác sĩ.\n• Hướng dẫn chăm sóc và vệ sinh răng miệng tại nhà.\n\nBạn muốn tìm hiểu thêm? Hãy gửi yêu cầu tư vấn để đội ngũ Mộc An liên hệ với bạn.',slug:'cham-soc-rang-dinh-ky',seoTitle:'Chăm sóc răng định kỳ | Nha khoa Mộc An',seoDesc:'Tìm hiểu dịch vụ chăm sóc răng định kỳ tại Nha khoa Mộc An. Gửi yêu cầu để được đội ngũ nha khoa tư vấn.'};
let working={...initialService},saved={...initialService},published={...initialService,summary:'Thông tin dịch vụ chăm sóc răng miệng định kỳ tại Nha khoa Mộc An.',body:'Khám răng định kỳ giúp bạn chủ động chăm sóc răng miệng. Liên hệ nha khoa để được tư vấn thêm thông tin dịch vụ.'};
const tenants=[
 {name:'Nha khoa Mộc An',slug:'moc-an',initials:'MA',status:'Đang hoạt động',color:'green',admins:2,date:'01/10/2026',tone:'green'},
 {name:'Nha khoa An Nhiên',slug:'an-nhien',initials:'AN',status:'Đang hoạt động',color:'green',admins:1,date:'03/10/2026',tone:''},
 {name:'Nha khoa Bình Minh',slug:'binh-minh',initials:'BM',status:'Chưa xuất bản',color:'gray',admins:1,date:'06/10/2026',tone:'blue'},
 {name:'Nha khoa Sông Xanh',slug:'song-xanh',initials:'SX',status:'Đang hoạt động',color:'green',admins:2,date:'08/10/2026',tone:'blue'},
 {name:'Nha khoa Hướng Dương',slug:'huong-duong',initials:'HD',status:'Đang hoạt động',color:'green',admins:1,date:'10/10/2026',tone:''},
 {name:'Nha khoa Ánh Mai',slug:'anh-mai',initials:'AM',status:'Tạm ngưng',color:'amber',admins:1,date:'12/10/2026',tone:'rose'}
];
const leads=[
 {id:1,name:'Khách mẫu 01',initials:'01',contact:'09•• ••• 101',email:'guest01@example.invalid',service:'Chăm sóc răng định kỳ',status:'Mới',assignee:'Chưa phân công',time:'09:42',source:'Trang dịch vụ',message:'Tôi muốn tìm hiểu chi phí và thông tin dịch vụ. Nhờ nha khoa liên hệ tư vấn giúp tôi.',channel:'Điện thoại',history:[]},
 {id:2,name:'Khách mẫu 02',initials:'02',contact:'09•• ••• 102',email:'guest02@example.invalid',service:'Niềng răng',status:'Mới',assignee:'Chưa phân công',time:'09:18',source:'Trang chủ',message:'Tôi muốn tìm hiểu các lựa chọn niềng răng đang có tại nha khoa.',channel:'Email',history:[]},
 {id:3,name:'Khách mẫu 03',initials:'03',contact:'09•• ••• 103',email:'guest03@example.invalid',service:'Chăm sóc răng định kỳ',status:'Đã phân công',assignee:'Minh · Quản trị viên',time:'08:56',source:'Trang dịch vụ',message:'Nhờ nha khoa gọi lại để trao đổi thông tin dịch vụ.',channel:'Điện thoại',history:[]},
 {id:4,name:'Khách mẫu 04',initials:'04',contact:'09•• ••• 104',email:'guest04@example.invalid',service:'Tư vấn chung',status:'Mới',assignee:'Chưa phân công',time:'08:35',source:'Trang liên hệ',message:'Tôi muốn được hướng dẫn tìm cơ sở gần nhất.',channel:'Điện thoại',history:[]},
 {id:5,name:'Khách mẫu 05',initials:'05',contact:'09•• ••• 105',email:'guest05@example.invalid',service:'Niềng răng',status:'Đã liên hệ',assignee:'An · Quản trị viên',time:'Hôm qua',source:'Trang dịch vụ',message:'Tôi muốn biết thêm thông tin dịch vụ để cân nhắc.',channel:'Email',history:[]},
 {id:6,name:'Khách mẫu 06',initials:'06',contact:'09•• ••• 106',email:'guest06@example.invalid',service:'Tư vấn chung',status:'Đã đóng',assignee:'Minh · Quản trị viên',time:'Hôm qua',source:'Trang chủ',message:'Cảm ơn nha khoa đã gửi thông tin tư vấn.',channel:'Email',reason:'Đã hoàn tất',history:[]}
];
const statusColor = status => ({'Mới':'blue','Đã phân công':'amber','Đã liên hệ':'green','Đã đóng':'gray'}[status]);

function sidebar(){
 const platform=screen==='platform';
 return `<aside class="sidebar" id="sidebar" aria-label="Điều hướng ${platform?'nền tảng':'CMS'}" inert>
  <div class="logo"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>godent<span class="dot">.</span></div>
  <div class="space-label">${platform?'PLATFORM ADMIN':'WORKSPACE'}</div>
  <button class="icon-button menu-close" data-close-menu aria-label="Đóng menu">${icon('close')}</button>
  ${platform?`<div class="nav-section">QUẢN LÝ NỀN TẢNG</div><nav class="nav-list">${navLink('Nha khoa','clinic','platform',true)}${navLink('Tài khoản quản trị','users',null)}${navLink('Tính năng & hạn mức','layers',null)}${navLink('Nhật ký hoạt động','history',null)}${navLink('Cấu hình nền tảng','settings',null)}</nav>`:
  `<div class="clinic-switch"><span class="clinic-symbol">M</span><div><strong>Nha khoa Mộc An</strong><small>Website nha khoa</small></div></div>
  <nav class="nav-list" aria-label="Chức năng website">${navLink('Tổng quan','grid','overview',screen==='overview')}
  <div class="nav-section">WEBSITE & NỘI DUNG</div>
  <details class="nav-group"><summary>${icon('layers',17)}Website<span class="nav-chevron">${icon('chevronDown',13)}</span></summary><div class="subnav">${navLink('Trang','doc',null)}${navLink('Giao diện','layers',null)}${navLink('Menu','menu',null)}</div></details>
  <details class="nav-group" ${screen==='editor'?'open':''}><summary>${icon('smile',17)}Nội dung nha khoa<span class="nav-chevron">${icon('chevronDown',13)}</span></summary><div class="subnav">${navLink('Dịch vụ','doc','editor',screen==='editor')}${navLink('Bác sĩ','users',null)}${navLink('Cơ sở','clinic',null)}${navLink('Bảng giá','layers',null)}</div></details>
  <details class="nav-group"><summary>${icon('leaf',17)}Câu chuyện khách hàng<span class="nav-chevron">${icon('chevronDown',13)}</span></summary><div class="subnav">${navLink('Ca điều trị','doc',null)}${navLink('Trước & sau','image',null)}${navLink('Đánh giá','chat',null)}</div></details>
  ${navLink('Bài viết & FAQ','doc',null)}${navLink('Khuyến mãi & Landing','layers',null)}${navLink('Thư viện hình ảnh','image',null)}
  <div class="nav-section">CHĂM SÓC KHÁCH HÀNG</div>${navLink('Yêu cầu tư vấn','chat','leads',screen==='leads',String(leads.filter(l=>l.status==='Mới').length))}
  <div class="nav-section">THIẾT LẬP</div>${navLink('Cài đặt website','settings',null)}</nav>`}
  <div class="sidebar-bottom"><div class="help-card"><strong>Một chút hỗ trợ?</strong><p>Hướng dẫn để quản lý website dễ dàng hơn.</p><button class="btn subtle" data-help>Xem hướng dẫn ${icon('arrow',13)}</button></div><div class="side-footer"><span>© 2026 Godent</span><span>Tiếng Việt</span></div></div>
 </aside><div class="mobile-overlay" data-close-menu></div>`;
}

function header(){
 const platform=screen==='platform';
 const crumb={platform:'Nha khoa',overview:'Tổng quan',editor:'Dịch vụ',leads:'Yêu cầu tư vấn'}[screen];
 return `<header class="topbar"><div class="topbar-left"><button class="icon-button menu-button" data-open-menu aria-label="Mở menu" aria-expanded="false" aria-controls="sidebar">${icon('menu')}</button><div class="breadcrumbs"><span>${platform?'Platform': 'Nha khoa Mộc An'}</span>${icon('chevron',11)}<strong>${crumb}</strong></div></div><div class="top-actions">${platform?'<span class="small muted top-date">Thứ Năm, 15 tháng 10, 2026</span>':`<button class="btn" data-live>${icon('external',13)}Xem website</button>`}<span class="top-divider"></span><button class="icon-button" data-profile aria-label="Tài khoản quản trị mẫu"><span class="avatar">${platform?'GD':'MN'}</span></button></div></header>`;
}

function pageHead(eyebrow,title,desc,actions=''){
 return `<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${desc}</p></div>${actions?`<div class="buttons">${actions}</div>`:''}</div>`;
}

function platformPage(){
 return `${pageHead('Không gian nền tảng','Nha khoa','Quản lý các website nha khoa trên nền tảng Godent.',`<button class="btn primary" data-create-tenant>${icon('plus',15)}Thêm nha khoa</button>`)}
 <div class="tenant-stats"><div><b>06</b>nha khoa</div><div><b>04</b>đang hoạt động</div><div><b>01</b>chưa xuất bản</div></div>
 <section class="panel" aria-label="Danh sách nha khoa"><div class="toolbar"><label class="search">${icon('search',16)}<input id="tenant-search" type="search" placeholder="Tìm tên nha khoa hoặc đường dẫn…" aria-label="Tìm nha khoa"></label><select class="select" id="tenant-status" aria-label="Lọc trạng thái nha khoa"><option value="">Tất cả trạng thái</option><option>Đang hoạt động</option><option>Chưa xuất bản</option><option>Tạm ngưng</option></select><span class="right-label" id="tenant-count">6 nha khoa</span></div>
 <div class="table-wrap"><table class="tenant-table"><thead><tr><th>Nha khoa</th><th>Địa chỉ website</th><th>Trạng thái</th><th class="admin-col">Quản trị viên</th><th class="created-col">Ngày tạo</th><th><span class="muted">Thao tác</span></th></tr></thead><tbody id="tenant-rows"></tbody></table></div>
 <div class="footer-row"><span id="tenant-footer">Hiển thị 6 / 6 nha khoa</span><div class="pagination"><button disabled aria-label="Trang trước">${icon('chevronLeft',14)}</button><button class="current" aria-current="page">1</button><button disabled aria-label="Trang sau">${icon('chevron',14)}</button></div></div></section>
 <div class="context-note">${icon('shield',14)}<span>Khu vực quản lý nền tảng. Nội dung riêng và yêu cầu tư vấn của nha khoa được quản lý trong Tenant CMS.</span></div>`;
}

function renderTenantRows(){
 const search=document.querySelector('#tenant-search').value.toLocaleLowerCase('vi').trim();
 const filter=document.querySelector('#tenant-status').value;
 const matches=tenants.filter(t=>(!filter||t.status===filter)&&(!search||(t.name+' '+t.slug).toLocaleLowerCase('vi').includes(search)));
 document.querySelector('#tenant-rows').innerHTML=matches.length?matches.map(t=>`<tr><td><div class="org"><span class="org-badge ${t.tone}">${t.initials}</span><div><strong>${t.name}</strong><small>Website nha khoa</small></div></div></td><td><span class="mono">godent.vn/${t.slug}</span></td><td>${badge(t.status,t.color,true)}</td><td class="admin-col">${t.admins} tài khoản</td><td class="created-col muted">${t.date}</td><td><button class="icon-button" data-tenant="${t.slug}" aria-label="Chi tiết ${t.name}">${icon('arrow',16)}</button></td></tr>`).join(''):'<tr><td colspan="6"><div class="state-panel"><h2>Không tìm thấy nha khoa</h2><p>Thử tên hoặc đường dẫn khác, hoặc bỏ bộ lọc.</p><button class="btn" data-reset-tenants>Xóa bộ lọc</button></div></td></tr>';
 document.querySelector('#tenant-count').textContent=`${matches.length} nha khoa`;
 document.querySelector('#tenant-footer').textContent=`Hiển thị ${matches.length} / ${tenants.length} nha khoa`;
}

function overviewPage(){
 const stat=(label,value,note,name)=>`<div class="stat-card"><div class="stat-label">${label}${icon(name,16)}</div><div class="stat-number">${value}</div><div class="stat-note">${note}</div></div>`;
 const task=(name,title,copy,action,target,count='')=>`<div class="task-row"><div class="task-icon">${icon(name,16)}</div><div class="task-copy"><strong>${title}</strong><p>${copy}</p><button class="btn subtle" data-go="${target}">${action} ${icon('arrow',12)}</button></div>${count?`<span class="task-num">${count}</span>`:''}</div>`;
 const recent=(title,type,status,color)=>`<div class="recent-item"><div class="doc-icon">${icon('doc',16)}</div><div class="copy"><button class="lead-name" ${title===initialService.title?'data-go="editor"':'data-unavailable="true"'}>${title}</button><small>${type} · Cập nhật hôm nay</small></div>${badge(status,color)}</div>`;
 return `${pageHead('Nha khoa Mộc An','Chào Minh, một ngày tốt lành.','Mọi điều bạn cần để chăm sóc website hôm nay.',`<button class="btn primary" data-go="editor">${icon('plus',15)}Tạo nội dung</button>`)}
 <section class="hero-panel"><div><div class="eyebrow">Không gian số cho nụ cười</div><h2>Website của bạn đang hoạt động.</h2><p>Thông tin nha khoa, dịch vụ và những câu chuyện của bạn đã sẵn sàng để khách hàng khám phá.</p><div class="site-link">${icon('globe',14)}<span>godent.vn/moc-an</span><button class="btn" data-live>Xem website ${icon('external',11)}</button></div></div><div class="hero-art" aria-hidden="true"><div class="art-window"><div class="art-top"><i></i><i></i><i></i></div><div class="art-content"><div class="art-lines"><i></i><i></i><i></i></div><div class="art-tooth">${icon('smile',25)}</div></div></div><span class="art-check">${icon('check',15)}</span></div></section>
 <div class="stat-row">${stat('Nội dung đã xuất bản','24','<strong>Đang hiển thị</strong> trên website','doc')}${stat('Thay đổi chưa xuất bản','03','Lưu nháp không đổi bản đang chạy','history')}${stat('Yêu cầu tư vấn mới',String(leads.filter(l=>l.status==='Mới').length).padStart(2,'0'),'<strong>Cần phản hồi</strong> từ đội ngũ nha khoa','chat')}</div>
 <div class="two-col"><section class="panel"><div class="panel-head"><h2>Nội dung gần đây</h2><button class="inline-link" data-go="editor">Soạn dịch vụ ${icon('arrow',13)}</button></div>${recent('Chăm sóc răng định kỳ','Dịch vụ','Có bản nháp','amber')}${recent('Đội ngũ bác sĩ Mộc An','Trang','Đã xuất bản','green')}${recent('Chăm sóc nụ cười mỗi ngày','Bài viết','Nháp','gray')}${recent('Niềng răng: những điều cần biết','Dịch vụ','Đã xuất bản','green')}</section>
 <div class="section-stack"><section class="panel"><div class="panel-head"><h2>Việc cần làm</h2>${badge('Hôm nay','gray')}</div>${task('history','Có thay đổi chưa xuất bản','Kiểm tra bản nháp trước khi cập nhật website.','Mở bản nháp','editor','3')}${task('chat','Phản hồi yêu cầu mới','Khách hàng đang chờ nha khoa liên hệ.','Xem yêu cầu','leads','3')}${task('search','Hoàn thiện nội dung SEO','Bổ sung mô tả giúp người đọc hiểu trang dịch vụ.','Kiểm tra dịch vụ','editor')}</section></div></div>`;
}

function editorPage(){
 return `<div class="page-head editor-head"><div><div class="eyebrow">Nội dung nha khoa / Dịch vụ</div><h1 id="editor-heading">${escapeHTML(working.title)}</h1><div class="buttons editor-badges">${badge('Đã xuất bản','green',true)}<span id="draft-indicator">${badge('Có thay đổi chưa xuất bản','amber')}</span></div></div><div class="buttons"><button class="btn" data-save>${icon('check',14)}Lưu bản nháp</button><button class="btn" data-preview>${icon('eye',15)}Xem trước</button><button class="btn primary" data-publish>${icon('external',14)}Cập nhật website</button></div></div>
 <div id="editor-alert" class="alert" ${reviewState==='conflict'?'':'hidden'}>${icon('info',18)}<span>Phiên bản đã thay đổi trong lúc bạn chỉnh sửa. Nội dung đang nhập vẫn được giữ lại. Hãy đối chiếu trước khi lưu.</span><button class="btn" data-compare>Đối chiếu</button></div>
 <div class="editor-layout"><section class="panel"><div class="tabs-line" role="tablist" aria-label="Nội dung dịch vụ"><button class="tab" role="tab" id="tab-content" aria-selected="${editorTab==='content'}" aria-controls="editor-content" data-tab="content">Nội dung</button><button class="tab" role="tab" id="tab-seo" aria-selected="${editorTab==='seo'}" aria-controls="editor-seo" data-tab="seo">SEO & đường dẫn</button><span class="locale" title="Bản tiếng Việt">VI · Tiếng Việt</span></div>
 <div class="panel-body" id="editor-content" role="tabpanel" aria-labelledby="tab-content" ${editorTab==='content'?'':'hidden'}><div class="field"><label for="service-title">Tên dịch vụ <em>*</em></label><input class="input large" id="service-title" aria-describedby="title-error" maxlength="160" value="${escapeHTML(working.title)}" required><div class="error-text" id="title-error" hidden>Nhập tên dịch vụ trước khi lưu.</div></div>
 <div class="field"><label for="service-summary">Giới thiệu ngắn</label><textarea class="input" id="service-summary" rows="3">${escapeHTML(working.summary)}</textarea><div class="hint"><span>Giới thiệu rõ ràng, gần gũi với người đọc.</span></div></div>
 <div class="field"><label for="service-body">Nội dung chi tiết</label><div class="text-editor"><div class="editor-tools"><button data-insert="heading" title="Chèn tiêu đề đoạn" aria-label="Chèn tiêu đề đoạn">${icon('heading',16)}</button><button data-insert="bullet" aria-label="Thêm dòng danh sách">${icon('list',15)}</button><span class="small muted">Văn bản</span></div><textarea id="service-body" rows="12">${escapeHTML(working.body)}</textarea><div class="editor-bottom"><span id="word-count">${working.body.trim().split(/\s+/).length} từ</span><span>VI · Tiếng Việt</span></div></div></div></div>
 <div class="panel-body" id="editor-seo" role="tabpanel" aria-labelledby="tab-seo" ${editorTab==='seo'?'':'hidden'}><div class="field"><label for="service-slug">Đường dẫn trang</label><input class="input mono" id="service-slug" aria-describedby="slug-error" value="${escapeHTML(working.slug)}"><div class="hint">godent.vn/moc-an/dich-vu/<span id="slug-preview">${escapeHTML(working.slug)}</span></div><div class="error-text" id="slug-error" hidden>Dùng chữ thường không dấu, số và dấu gạch ngang.</div></div><div class="field"><label for="seo-title">Tiêu đề SEO</label><input class="input" id="seo-title" value="${escapeHTML(working.seoTitle)}"></div><div class="field"><label for="seo-description">Mô tả SEO</label><textarea class="input" id="seo-description">${escapeHTML(working.seoDesc)}</textarea><div class="hint">Mô tả đúng nội dung trang, không cam kết kết quả điều trị.</div></div><div class="field"><span>Xem trước kết quả tìm kiếm</span><div class="seo-preview"><div class="url" id="seo-url">godent.vn › moc-an › dich-vu</div><div class="title" id="seo-preview-title">${escapeHTML(working.seoTitle)}</div><div class="desc" id="seo-preview-desc">${escapeHTML(working.seoDesc)}</div></div></div></div></section>
 <aside class="section-stack" aria-label="Thông tin xuất bản"><section class="panel"><div class="panel-head"><h2>Xuất bản</h2>${icon('globe',16)}</div><div class="publish-body"><div class="meta-row"><span>Trạng thái website</span>${badge('Đã xuất bản','green')}</div><div class="meta-row"><span>Phiên bản đang chạy</span><strong id="live-version">Phiên bản ${version}</strong></div><div class="meta-row"><span>Bản nháp</span><strong id="save-status">Đã lưu · 10:24</strong></div><div class="meta-row"><span>Ngôn ngữ</span><span>Tiếng Việt</span></div><div class="publish-note">Lưu bản nháp không làm thay đổi website. Chỉ cập nhật khi bạn chọn <strong>Cập nhật website</strong>.</div><div class="divider"></div><button class="btn subtle" data-history>${icon('history',14)}Lịch sử phiên bản</button></div></section>
 <section class="panel"><div class="panel-head"><h2>Ảnh đại diện</h2></div><div class="cover-art" role="img" aria-label="Biểu tượng nụ cười Lucide trên nền xanh nhạt">${icon('smile',56)}</div><div class="cover-copy">Biểu tượng Lucide cho bản thiết kế. Thư viện và tải ảnh được thiết kế ở bước sau.</div></section>
 <div class="context-note">${icon('info',14)}<span>Chỉ dùng 2 trạng thái: Nháp và Đã xuất bản. Không có bước chờ duyệt.</span></div></aside></div>`;
}

function leadsPage(){
 return `${pageHead('Chăm sóc khách hàng','Yêu cầu tư vấn','Một nơi để tiếp nhận và phản hồi các yêu cầu từ website.')}
 <div class="leads-layout" id="leads-layout"><section class="panel leads-list" aria-label="Danh sách yêu cầu"><div class="toolbar"><label class="search">${icon('search',16)}<input type="search" id="lead-search" aria-label="Tìm yêu cầu tư vấn" placeholder="Tìm tên hoặc mã yêu cầu…"></label><select class="select" id="lead-filter" aria-label="Lọc trạng thái yêu cầu"><option value="">Tất cả trạng thái</option><option>Mới</option><option>Đã phân công</option><option>Đã liên hệ</option><option>Đã đóng</option></select></div><div class="table-wrap"><table class="lead-table"><thead><tr><th>Khách hàng</th><th class="service-col">Quan tâm</th><th>Trạng thái</th><th class="time-col">Tiếp nhận</th></tr></thead><tbody id="lead-rows"></tbody></table></div><div class="footer-row"><span id="lead-count">6 yêu cầu · Tất cả người phụ trách</span><span>15/10/2026</span></div></section>
 <aside class="panel detail-panel" id="lead-detail" aria-label="Chi tiết yêu cầu"></aside></div><div class="context-note">${icon('users',14)}<span>Tất cả quản trị viên của nha khoa đều thấy danh sách này. Phân công để xác định người phụ trách.</span></div>`;
}

function renderLeadRows(){
 const search=document.querySelector('#lead-search').value.toLocaleLowerCase('vi').trim();
 const filter=document.querySelector('#lead-filter').value;
 const matches=leads.filter(l=>(!filter||l.status===filter)&&(!search||(`${l.name} YC-00${l.id}`).toLocaleLowerCase('vi').includes(search)));
 document.querySelector('#lead-rows').innerHTML=matches.length?matches.map(l=>`<tr class="${l.id===selectedLead?'selected':''}"><td><button class="lead-name" data-lead="${l.id}" aria-label="Mở yêu cầu ${l.name}">${l.name}</button><div class="contact">${l.contact}</div><small>YC-00${l.id}</small></td><td class="service-col"><span>${l.service}</span></td><td>${badge(l.status,statusColor(l.status))}</td><td class="time-col muted">${l.time}</td></tr>`).join(''):'<tr><td colspan="4"><div class="state-panel"><h2>Không tìm thấy yêu cầu</h2><p>Thử từ khóa khác hoặc xóa bộ lọc.</p><button class="btn" data-reset-leads>Xóa bộ lọc</button></div></td></tr>';
 document.querySelector('#lead-count').textContent=`${matches.length} yêu cầu · Tất cả người phụ trách`;
 if(matches.length&&!matches.some(l=>l.id===selectedLead))selectedLead=matches[0].id;
 document.querySelectorAll('#lead-rows tr').forEach(row=>row.classList.toggle('selected',row.querySelector('[data-lead]')?.dataset.lead===String(selectedLead)));
 if(matches.length) renderLeadDetail();
 else document.querySelector('#lead-detail').innerHTML='<div class="panel-body"><h2>Chưa chọn yêu cầu</h2><p>Không có yêu cầu phù hợp với bộ lọc hiện tại.</p></div>';
}

function renderLeadDetail(){
 const l=leads.find(x=>x.id===selectedLead);
 const options=(values,selected)=>values.map(v=>`<option ${v===selected?'selected':''}>${escapeHTML(v)}</option>`).join('');
 document.querySelector('#lead-detail').innerHTML=`<div class="panel-head"><h2>Chi tiết yêu cầu</h2><span class="mono muted">YC-00${l.id}</span></div><div class="detail-body"><button class="btn detail-back" data-back-leads>${icon('back',14)}Danh sách yêu cầu</button><div class="detail-title"><span class="detail-avatar">${l.initials}</span><div><h2 tabindex="-1" id="lead-detail-title">${l.name}</h2><small>${l.time} · 15/10/2026</small></div></div><div class="contact-line">${icon('phone',15)}<span>${l.contact}</span></div><div class="contact-line">${icon('mail',15)}<span>${l.email}</span></div><div class="divider"></div><div class="meta-row"><span>Quan tâm</span><span>${l.service}</span></div><div class="meta-row"><span>Nguồn</span><span>${l.source}</span></div><div class="meta-row"><span>Ngôn ngữ / Kênh</span><span>VI / ${l.channel}</span></div><p class="small muted">Lời nhắn</p><div class="request-copy">${l.message}</div><div class="small muted">${icon('check',12)} Đã đồng ý để nha khoa liên hệ</div><div class="divider"></div><div class="detail-field"><label for="lead-assignee">Người phụ trách</label><select class="select" id="lead-assignee">${options(['Chưa phân công','Minh · Quản trị viên','An · Quản trị viên'],l.assignee)}</select></div><div class="detail-field"><label for="lead-status">Trạng thái</label><select class="select" id="lead-status">${options(['Mới','Đã phân công','Đã liên hệ','Đã đóng'],l.status)}</select></div><div class="detail-field" id="reason-field" ${l.status==='Đã đóng'?'':'hidden'}><label for="lead-reason">Lý do đóng</label><select class="select" id="lead-reason"><option value="">Chọn lý do</option>${options(['Đã hoàn tất','Không liên hệ được','Spam','Trùng yêu cầu'],l.reason||'')}</select></div><div class="detail-field" id="reopen-field" hidden><label for="reopen-reason">Lý do mở lại</label><textarea class="input" id="reopen-reason" placeholder="Ghi lý do để lưu lịch sử…"></textarea></div><div id="lead-error" class="error-text" hidden></div><button class="btn primary full" data-update-lead>Lưu cập nhật</button><div class="divider"></div><h3>Lịch sử hoạt động</h3><div class="timeline">${l.history.map(h=>`<div class="timeline-item">${escapeHTML(h)}<small>Vừa xong · Minh</small></div>`).join('')}<div class="timeline-item">Tiếp nhận từ ${l.source.toLowerCase()}<small>${l.time} · Website</small></div></div><div class="retention-note">${icon('clock',13)}<span>Thời hạn lưu tuân theo chính sách đã chốt. Xem hoặc đổi người phụ trách không kéo dài thời hạn.</span></div></div>`;
}

function statePage(){
 const titles={platform:'Nha khoa',overview:'Tổng quan website',editor:'Soạn dịch vụ',leads:'Yêu cầu tư vấn'};
 const head=pageHead(screen==='platform'?'Không gian nền tảng':'Nha khoa Mộc An',titles[screen],'');
 if(reviewState==='loading')return `${head}<section class="panel panel-body" aria-busy="true" aria-label="Đang tải nội dung"><div class="skeleton title"></div><div class="skeleton block"></div><div class="skeleton line"></div><div class="skeleton line"></div><div class="skeleton line"></div><p class="small">Đang tải dữ liệu…</p></section>`;
 const copy=reviewState==='error'?['globe','Chưa tải được dữ liệu','Nội dung chưa được tải. Bạn có thể thử lại mà không thay đổi dữ liệu.','Thử lại']:reviewState==='denied'?['shield','Bạn chưa có quyền truy cập','Liên hệ quản trị viên để kiểm tra quyền. Nội dung của khu vực này chưa được hiển thị.','Về tổng quan']:screen==='leads'?['chat','Chưa có yêu cầu tư vấn','Khi khách gửi biểu mẫu trên website, yêu cầu sẽ xuất hiện tại đây.','Xem giao diện có dữ liệu']:screen==='platform'?['clinic','Bắt đầu với nha khoa đầu tiên','Tạo không gian website để bắt đầu thiết lập thông tin nha khoa.','Xem form tạo nha khoa']:screen==='editor'?['doc','Viết dịch vụ đầu tiên','Giới thiệu dịch vụ bằng nội dung rõ ràng và hình ảnh phù hợp.','Tạo bản nháp']:['leaf','Chào mừng đến website của bạn','Bắt đầu bằng thông tin nha khoa và dịch vụ đầu tiên. Bạn có thể xem trước trước khi xuất bản.','Soạn dịch vụ đầu tiên'];
 return `${head}<section class="state-panel"><span class="state-icon">${icon(copy[0],27)}</span><h2>${copy[1]}</h2><p>${copy[2]}</p><button class="btn primary" data-state-action>${copy[3]} ${icon('arrow',14)}</button></section>`;
}

function render(){
 const content=['normal','conflict'].includes(reviewState)?({platform:platformPage,overview:overviewPage,editor:editorPage,leads:leadsPage}[screen])():statePage();
 document.querySelector('#app').innerHTML=`${sidebar()}<div class="shell">${header()}<main class="main" id="main" tabindex="-1">${content}<footer class="main-footer"><span>Được xây dựng cùng Godent</span><span>${screen==='platform'?'Không gian quản lý nền tảng':'Website nha khoa · Nội dung của bạn, thương hiệu của bạn'}</span></footer></main></div>`;
 syncSidebarInert();
 if(['normal','conflict'].includes(reviewState)){
  if(screen==='platform'){renderTenantRows();document.querySelector('#tenant-search').addEventListener('input',renderTenantRows);document.querySelector('#tenant-status').addEventListener('change',renderTenantRows);}
  if(screen==='leads'){renderLeadRows();document.querySelector('#lead-search').addEventListener('input',renderLeadRows);document.querySelector('#lead-filter').addEventListener('change',renderLeadRows);}
  if(screen==='editor')bindEditor();
 }
 document.title=`Godent · ${{platform:'Nha khoa',overview:'Tổng quan',editor:'Soạn dịch vụ',leads:'Yêu cầu tư vấn'}[screen]}`;
}

function go(target){
 if(draftDirty&&screen==='editor'&&target!=='editor'){
  openModal('Bạn có thay đổi chưa lưu','<p>Giữ lại bản đang viết hoặc bỏ thay đổi trước khi chuyển màn hình.</p><div class="buttons"><button class="btn" data-modal-close>Tiếp tục soạn</button><button class="btn primary" id="leave-editor">Bỏ thay đổi và chuyển</button></div>');
  document.querySelector('#leave-editor').onclick=()=>{working={...saved};draftDirty=false;closeModal();navigate(target)};
  return;
 }
 navigate(target);
}
function navigate(target){screen=target;reviewState='normal';history.replaceState(null,'','?screen='+screen);render();window.scrollTo(0,0);document.querySelector('#main').focus({preventScroll:true});window.parent.postMessage({screen},location.origin);}
function syncSidebarInert(){const sidebar=document.querySelector('#sidebar');if(sidebar)sidebar.inert=innerWidth<1024&&!sidebar.classList.contains('open');}
function setMenu(open){const side=document.querySelector('#sidebar');side.classList.toggle('open',open);syncSidebarInert();document.querySelector('.shell').inert=open;document.querySelector('[data-open-menu]').setAttribute('aria-expanded',String(open));if(open)document.querySelector('[data-close-menu]').focus();else document.querySelector('[data-open-menu]').focus();}
function openModal(title,body){const modal=document.querySelector('#modal');returnFocus=document.activeElement;document.querySelector('#modal-content').innerHTML=`<div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-button" data-modal-close aria-label="Đóng">${icon('close')}</button></div><div class="modal-body">${body}</div>`;if(!modal.open)modal.showModal();}
function closeModal(){document.querySelector('#modal').close();returnFocus?.focus?.();}
function toast(message){clearTimeout(toastTimer);const box=document.querySelector('#toast');box.textContent=message;box.hidden=false;toastTimer=setTimeout(()=>box.hidden=true,5000);}
function previewService(live=false){
 const content=live?published:working;
 openModal(live?'Website · bản đã xuất bản':'Xem trước · bản đang soạn',`<p>${live?'Nội dung phiên bản đang chạy trong mô phỏng.':'Bản xem trước riêng tư trong mockup, chưa xuất bản.'}</p><div class="preview-page"><div class="preview-brand">NHA KHOA MỘC AN</div><h3>${escapeHTML(content.title)}</h3><p>${escapeHTML(content.summary)}</p><div class="divider"></div><p>${escapeHTML(content.body)}</p></div><div class="buttons"><button class="btn" data-modal-close>Đóng xem trước</button></div>`);
}
function bindEditor(){
 activateTab(editorTab);
 const fields={'service-title':'title','service-summary':'summary','service-body':'body','service-slug':'slug','seo-title':'seoTitle','seo-description':'seoDesc'};
 for(const [id,key] of Object.entries(fields))document.getElementById(id).addEventListener('input',e=>{
  working[key]=e.target.value;draftDirty=true;
  document.querySelector('#save-status').textContent='Chưa lưu thay đổi';
  document.querySelector('#draft-indicator').innerHTML=badge('Có thay đổi chưa xuất bản','amber');
  document.querySelector('#editor-heading').textContent=working.title||'Dịch vụ mới';
  document.querySelector('#word-count').textContent=`${working.body.trim()?working.body.trim().split(/\s+/).length:0} từ`;
  document.querySelector('#slug-preview').textContent=working.slug;
  document.querySelector('#seo-preview-title').textContent=working.seoTitle;
  document.querySelector('#seo-preview-desc').textContent=working.seoDesc;
 });
}
function validateEditor(){
 const titleValid=!!working.title.trim(),slugValid=/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(working.slug);
 document.querySelector('#title-error').hidden=titleValid;
 document.querySelector('#slug-error').hidden=slugValid;
 document.querySelector('#service-title').setAttribute('aria-invalid',String(!titleValid));
 document.querySelector('#service-slug').setAttribute('aria-invalid',String(!slugValid));
 if(!titleValid||!slugValid){activateTab(titleValid?'seo':'content');document.querySelector(titleValid?'#service-slug':'#service-title').focus();return false;}
 return true;
}
function activateTab(tab){editorTab=tab;document.querySelectorAll('[data-tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.tab===tab));b.tabIndex=b.dataset.tab===tab?0:-1});document.querySelector('#editor-content').hidden=tab!=='content';document.querySelector('#editor-seo').hidden=tab!=='seo';}
function saveDraft(){
 if(!validateEditor())return;
 if(reviewState==='conflict'){document.querySelector('#editor-alert').hidden=false;document.querySelector('[data-compare]').focus();return;}
 saved={...working};draftDirty=false;document.querySelector('#save-status').textContent='Đã lưu · vừa xong';toast('Đã lưu bản nháp trong mockup. Bản website chưa thay đổi.');
}
function publish(){
 if(!validateEditor())return;
 if(reviewState==='conflict'){toast('Cần đối chiếu phiên bản trước khi cập nhật.');return;}
 if(draftDirty){openModal('Lưu bản nháp trước khi cập nhật','<p>Bạn còn thay đổi chưa lưu. Lưu bản nháp, kiểm tra lại rồi cập nhật website.</p><div class="buttons"><button class="btn" data-modal-close>Tiếp tục soạn</button><button class="btn primary" id="save-before-publish">Lưu bản nháp</button></div>');document.querySelector('#save-before-publish').onclick=()=>{closeModal();saveDraft()};return;}
 openModal('Cập nhật website?',`<p>Bản tiếng Việt của <strong>${escapeHTML(saved.title)}</strong> sẽ thay thế phiên bản đang hiển thị trong mô phỏng.</p><div class="publish-note">Đây là thao tác xem thử. Không có website thật hoặc dữ liệu nào được cập nhật.</div><div class="buttons"><button class="btn" data-modal-close>Quay lại</button><button class="btn primary" id="confirm-publish">Cập nhật website</button></div>`);
 document.querySelector('#confirm-publish').onclick=()=>{published={...saved};version++;document.querySelector('#live-version').textContent='Phiên bản '+version;document.querySelector('#draft-indicator').innerHTML=badge('Đã đồng bộ bản nháp','gray');closeModal();toast('Đã cập nhật bản website mô phỏng. Không có thay đổi trên hệ thống thật.');};
}
function updateLead(){
 const lead=leads.find(l=>l.id===selectedLead),status=document.querySelector('#lead-status').value,assignee=document.querySelector('#lead-assignee').value,reason=document.querySelector('#lead-reason').value,reopen=document.querySelector('#reopen-reason').value.trim(),error=document.querySelector('#lead-error');
 let message='';
 if(status==='Đã phân công'&&assignee==='Chưa phân công')message='Chọn người phụ trách để lưu trạng thái Đã phân công.';
 if(status==='Đã đóng'&&!reason)message='Chọn lý do đóng yêu cầu.';
 if(lead.status==='Đã đóng'&&status!=='Đã đóng'&&!reopen)message='Ghi lý do mở lại yêu cầu.';
 if(message){error.hidden=false;error.textContent=message;return;}
 const changed=lead.status!==status||lead.assignee!==assignee||(status==='Đã đóng'&&lead.reason!==reason);
 if(!changed){toast('Không có thay đổi cần lưu.');return;}
 lead.history.unshift(`${lead.status} → ${status}${status==='Đã đóng'?' · '+reason:''}${reopen?' · Mở lại: '+reopen:''} · ${assignee}`);
 lead.status=status;lead.assignee=assignee;lead.reason=status==='Đã đóng'?reason:'';
 renderLeadRows();document.querySelector('.nav-count').textContent=String(leads.filter(l=>l.status==='Mới').length);toast('Đã cập nhật yêu cầu mẫu trong bộ nhớ. Tải lại sẽ đặt lại dữ liệu.');
}

document.addEventListener('click',event=>{
 const button=event.target.closest('button,[data-close-menu]');if(!button)return;
 if(button.dataset.go){go(button.dataset.go);return;}
 if(button.hasAttribute('data-open-menu')){setMenu(true);return;}
 if(button.hasAttribute('data-close-menu')){setMenu(false);return;}
 if(button.hasAttribute('data-modal-close')){closeModal();return;}
 if(button.hasAttribute('data-unavailable')){openModal('Màn hình ở bước thiết kế tiếp theo','<p>Bản xem thử hiện có bốn màn hình: danh sách nha khoa, tổng quan CMS, soạn dịch vụ và yêu cầu tư vấn. Mục này minh họa vị trí trong menu, chưa được thiết kế chi tiết.</p><div class="buttons"><button class="btn" data-modal-close>Đã hiểu</button></div>');return;}
 if(button.hasAttribute('data-help')){openModal('Khám phá bản xem thử','<p>Dùng thanh Design Review bên ngoài để chuyển giữa bốn màn hình, thử mobile và xem các trạng thái tải, trống, lỗi hoặc từ chối quyền.</p><p>Bạn có thể tìm kiếm nha khoa, soạn và lưu bản nháp, xem trước, mô phỏng xuất bản, hoặc cập nhật yêu cầu tư vấn. Các thao tác chỉ nằm trong bộ nhớ.</p>');return;}
 if(button.hasAttribute('data-profile')){openModal('Tài khoản mẫu',`<p>${screen==='platform'?'Quản trị nền tảng Godent':'Minh · Quản trị viên Nha khoa Mộc An'}</p><p>Mockup không có phiên đăng nhập. Chính sách tạo tài khoản, khôi phục và MFA sẽ được chốt riêng.</p>`);return;}
 if(button.hasAttribute('data-live')){previewService(true);return;}
 if(button.dataset.tenant){const t=tenants.find(t=>t.slug===button.dataset.tenant);openModal(t.name,`<div class="meta-row"><span>Website</span><span class="mono">godent.vn/${t.slug}</span></div><div class="meta-row"><span>Trạng thái</span>${badge(t.status,t.color)}</div><div class="meta-row"><span>Quản trị viên</span><span>${t.admins} tài khoản</span></div><div class="publish-note">Chỉ thông tin vận hành nền tảng. Không mở nội dung riêng hoặc yêu cầu tư vấn từ đây.</div>`);return;}
 if(button.hasAttribute('data-create-tenant')){openModal('Thêm nha khoa','<p>Phác thảo thông tin ban đầu. Luồng cấp tài khoản và quyền truy cập sẽ được chốt trước S02.</p><div class="field"><label for="new-name">Tên nha khoa</label><input class="input" id="new-name" placeholder="Ví dụ: Nha khoa Ban Mai"></div><div class="field"><label for="new-slug">Đường dẫn Godent</label><input class="input mono" id="new-slug" placeholder="ban-mai"><div class="hint">godent.vn/tên-nha-khoa</div></div><div class="buttons"><button class="btn" data-modal-close>Đóng bản xem thử</button></div>');return;}
 if(button.hasAttribute('data-reset-tenants')){document.querySelector('#tenant-search').value='';document.querySelector('#tenant-status').value='';renderTenantRows();return;}
 if(button.hasAttribute('data-reset-leads')){document.querySelector('#lead-search').value='';document.querySelector('#lead-filter').value='';renderLeadRows();return;}
 if(button.dataset.lead){selectedLead=Number(button.dataset.lead);document.querySelectorAll('#lead-rows tr').forEach(row=>row.classList.toggle('selected',row.contains(button)));renderLeadDetail();document.querySelector('#leads-layout').classList.add('detail-open');if(innerWidth<768){document.querySelector('#lead-detail-title').focus();window.scrollTo(0,0);}return;}
 if(button.hasAttribute('data-back-leads')){document.querySelector('#leads-layout').classList.remove('detail-open');document.querySelector(`[data-lead="${selectedLead}"]`)?.focus();return;}
 if(button.hasAttribute('data-update-lead')){updateLead();return;}
 if(button.dataset.tab){activateTab(button.dataset.tab);return;}
 if(button.hasAttribute('data-save')){saveDraft();return;}
 if(button.hasAttribute('data-preview')){previewService();return;}
 if(button.hasAttribute('data-publish')){publish();return;}
 if(button.dataset.insert){const text=document.querySelector('#service-body'),insert=button.dataset.insert==='bullet'?'\n• ':'\n\nTiêu đề đoạn\n\n';text.setRangeText(insert,text.selectionStart,text.selectionEnd,'end');text.dispatchEvent(new Event('input'));text.focus();return;}
 if(button.hasAttribute('data-history')){openModal('Lịch sử phiên bản',`<p>Phiên bản đang chạy: <strong>${version}</strong>. Lưu bản nháp giữ nguyên phiên bản đang chạy.</p><div class="publish-note">Khôi phục, so sánh đầy đủ và hủy xuất bản nằm trong thiết kế slice S08, chưa được mô phỏng tại đây.</div>`);return;}
 if(button.hasAttribute('data-compare')){openModal('Đối chiếu thay đổi','<p>Những gì bạn đang nhập vẫn còn trong editor. Bản thiết kế này minh họa việc dừng lưu khi có xung đột; chưa mô phỏng ghép hai phiên bản.</p><div class="buttons"><button class="btn primary" data-modal-close>Giữ nội dung đang nhập</button></div>');return;}
 if(button.hasAttribute('data-state-action')){
  if(reviewState==='empty'&&screen==='platform'){reviewState='normal';render();window.parent.postMessage({screen},location.origin);document.querySelector('[data-create-tenant]').click();return;}
  if(reviewState==='denied'){go(screen==='platform'?'platform':'overview');return;}
  if(reviewState==='empty'&&screen==='overview'){go('editor');return;}
  reviewState='normal';render();window.parent.postMessage({screen},location.origin);return;
 }
});
document.addEventListener('change',event=>{
 if(event.target.id==='lead-status'){
  const lead=leads.find(l=>l.id===selectedLead),value=event.target.value;
  document.querySelector('#reason-field').hidden=value!=='Đã đóng';
  document.querySelector('#reopen-field').hidden=!(lead.status==='Đã đóng'&&value!=='Đã đóng');
 }
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&document.querySelector('#sidebar')?.classList.contains('open'))setMenu(false);
 const tab=event.target.closest('[role=tab]');
 if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'content':event.key==='End'?'seo':tab.dataset.tab==='content'?'seo':'content';activateTab(next);document.querySelector(`[data-tab="${next}"]`).focus();}
 if(event.key==='Tab'&&innerWidth<1024&&document.querySelector('#sidebar')?.classList.contains('open')){
  const focusable=[...document.querySelectorAll('#sidebar button,#sidebar summary')].filter(el=>el.getClientRects().length&&!el.disabled);
  const first=focusable[0],last=focusable.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
 }
});
document.querySelector('#modal').addEventListener('click',event=>{if(event.target===event.currentTarget&&event.offsetX>=0&&event.offsetX<=event.currentTarget.clientWidth&&event.offsetY>=0&&event.offsetY<=event.currentTarget.clientHeight)return;if(event.target===event.currentTarget)closeModal();});
window.addEventListener('resize',syncSidebarInert);
render();
