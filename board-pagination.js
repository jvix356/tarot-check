// 공개 글과 공지는 같은 5개 단위 규칙을 사용한다.
export function pageWindow(count, requested=1) {
 const totalPages=Math.max(1,Math.ceil(Math.max(0,Number(count)||0)/5));
 const page=Math.max(1,Math.min(totalPages,Math.floor(Number(requested)||1)));
 const groupStart=Math.floor((page-1)/5)*5+1,groupEnd=Math.min(totalPages,groupStart+4);
 return {page,totalPages,start:(page-1)*5,end:page*5,groupStart,groupEnd,pages:Array.from({length:groupEnd-groupStart+1},(_,i)=>groupStart+i)};
}
