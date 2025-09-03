import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

// 서버에서 받은 플랫 리스트 데이터를 D3 계층 구조로 변환
function transformData(flatData) {
    // 1. 데이터를 sectorName 기준으로 그룹화합니다.
    const groupedData = d3.group(flatData, d => d.sectorName);
    
    // 2. 그룹화된 데이터를 순회하며 D3 계층 구조에 맞게 변환합니다.
    const children = Array.from(groupedData, ([key, value]) => {
        const sectorName = key || '기타 섹터';
        
        // 3. 해당 섹터의 모든 종목을 자식 노드로 변환합니다.
        const sectorChildren = value.map(item => ({
            name: item.nodeName || '이름없음',
            value: item.mktcap || 0,
            fluc_rate: item.fluc_rate || 0,
            cur_price: item.currentPrice || 0,
        }));
        
        return { name: sectorName, children: sectorChildren };
    });
    
    return { name: 'Market', children };
}

// minPixel 미만 리프 노드를 데이터 트리에서 제거
function pruneByPixel(root, minPixel) {
    const keep = new Set();
    root.leaves().forEach(leaf => {
        const w = leaf.x1 - leaf.x0;
        const h = leaf.y1 - leaf.y0;
        const shouldKeep = w >= minPixel && h >= minPixel && (leaf.data.value || 0) > 0;
        if (shouldKeep) {
            let n = leaf;
            while (n) {
                keep.add(n.data);
                n = n.parent;
            }
        }
    });
    
    function cloneFilter(d) {
        if (!keep.has(d)) return null;
        if (!d.children) return { ...d };
        const kids = d.children.map(cloneFilter).filter(Boolean);
        return { ...d, children: kids };
    }
    
    const pruned = cloneFilter(root.data);
    return pruned || { name: root.data?.name || 'Market', children: [] };
}


function App() {
    const [view, setView] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [colorScale, setColorScale] = useState(null);
    const [layoutSize, setLayoutSize] = useState({ width: 500, height: 500 });
    const [isDragging, setIsDragging] = useState(false);
    
    const svgRef = useRef(null);
    const dragHandleRef = useRef(null);
    const ghostFrameRef = useRef(null);
    const dragStartSize = useRef(null);
    const dragStartInfo = useRef(null);
    
    const MIN_PIXEL = 15;
    
    // 데이터 로딩 useEffect
    useEffect(() => {
        const apiUrl = '/api/market-data';
        fetch(apiUrl)
            .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP error! status: ${res.status}`))))
            .then(flatJsonData => {
                if (!flatJsonData || flatJsonData.length === 0) throw new Error('서버 데이터가 비어있습니다.');
                const data = transformData(flatJsonData);
                let root = d3.hierarchy(data).sum(d => d.value || 0).sort((a, b) => b.value - a.value);
                root.eachAfter(node => {
                    if (node.children) {
                        const total = node.value;
                        node.data.fluc_rate = total > 0 ? d3.sum(node.children, d => (d.data.fluc_rate || 0) * d.value) / total : 0;
                    }
                });
                const color = d3.scaleDivergingPow().domain([-30, 0, 30]).exponent(0.15).interpolator(d3.interpolateRgbBasis(["#d14242", "#f0f0f0", "#33a033"])).clamp(true);
                setColorScale(() => color);
                setView(root);
                setLoading(false);
            })
            .catch(e => {
                console.error('API 호출 오류:', e);
                setError(`데이터 로딩 실패: ${e.message}`);
                setLoading(false);
            });
    }, []);

// ✨ [수정됨] 렌더링과 드래그 로직을 하나로 통합한 useEffect
    useEffect(() => {
        if (!view || !colorScale) return;
        
        const { width, height } = layoutSize;
        
        // --- 1. SVG 렌더링 ---
        const rootForLayout = view.copy();
        const treemap = d3.treemap().tile(d3.treemapBinary).size([width, height]).padding(2).round(true);
        treemap(rootForLayout);
        const prunedData = pruneByPixel(rootForLayout, MIN_PIXEL);
        let displayRoot = d3.hierarchy(prunedData).sum(d => d.value || 0).sort((a, b) => b.value - a.value);
        displayRoot.eachAfter(node => {
            if (node.children) {
                const total = node.value;
                node.data.fluc_rate = total > 0 ? d3.sum(node.children, d => (d.data.fluc_rate || 0) * d.value) / total : 0;
            }
        });
        treemap(displayRoot);
        const x = d3.scaleLinear().rangeRound([0, width]).domain([displayRoot.x0, displayRoot.x1]);
        const y = d3.scaleLinear().rangeRound([0, height]).domain([displayRoot.y0, displayRoot.y1]);
        const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
        svg.selectAll('*').remove();
        const group = svg.append('g');
        const cell = group.selectAll('g').data(displayRoot.children || []).join('g').attr('transform', d => `translate(${x(d.x0)}, ${y(d.y0)})`).style('cursor', d => (d.children ? 'pointer' : 'default')).on('click', (event, d) => {
            if (d.children) {
                const nextView = (view.children || []).find(child => child.data.name === d.data.name);
                if (nextView) setView(nextView);
            }
        });
        cell.append('rect').attr('fill', d => colorScale(d.data.fluc_rate)).attr('width', d => x(d.x1) - x(d.x0)).attr('height', d => y(d.y1) - y(d.y0));
        cell.each(function (d) {
            const node = d3.select(this);
            const w = x(d.x1) - x(d.x0);
            const h = y(d.y1) - y(d.y0);
            if (w >= 40 && h >= 40) {
                const fo = node.append('foreignObject').attr('width', w).attr('height', h);
                const div = fo.append('xhtml:div').style('display', 'flex').style('flex-direction', 'column').style('align-items', 'center').style('justify-content', 'center').style('width', '100%').style('height', '100%').style('overflow', 'hidden').style('text-align', 'center').style('color', 'black').style('font-weight', 'bold')
                    .style('font-size', `${Math.min(w / 6.5, h / 4, 50)}px`);
                div.append('xhtml:p').style('margin', '0').style('padding', '0 2px').style('white-space', 'nowrap').style('overflow', 'hidden').style('display', 'inline-block').style('max-width', '100%').text(d.data.name);
                const rate = d.data.fluc_rate || 0;
                div.append('xhtml:p').style('margin', '2px 0 0 0').style('padding', '0').text(`${rate > 0 ? '+' : ''}${rate.toFixed(2)}%`);
            }
        });
        cell.append('title').text(d => {
            const rateText = (d.data.fluc_rate || 0).toFixed(2);
            const baseText = `${d.data.name}\n`+(isNaN(d.data.cur_price)?"":`현재가: ${d3.format(",")(d.data.cur_price)} 원\n`)
                +`등락률: ${rateText}%\n시가총액: ${d.value?.toLocaleString()} 원`;
            return (d.data.name === '기타' && d.data.count) ? `${baseText}\n(${d.data.count}개 종목 합산)` : baseText;
        });
        
        // --- 2. 드래그 핸들 생성 및 이벤트 연결 ---
        const handleSize = 20;
        const handle = svg.append('g')
            .style('cursor', 'nwse-resize');
        
        handle.append('path')
            .attr('d', `M${width - handleSize},${height} L${width},${height} L${width},${height - handleSize} Z`)
            .attr('fill', '#666')
            .attr('stroke', 'white');
        
        const dragBehavior = d3.drag()
            .on('start', function(event) {
                event.sourceEvent.preventDefault();
                event.sourceEvent.stopPropagation();
                
                setIsDragging(true);
                dragStartInfo.current = {
                    width: layoutSize.width,
                    height: layoutSize.height,
                    x: event.x,
                    y: event.y
                };
                
                if (ghostFrameRef.current) {
                    ghostFrameRef.current.style.width = `${layoutSize.width}px`;
                    ghostFrameRef.current.style.height = `${layoutSize.height}px`;
                    ghostFrameRef.current.style.display = 'block';
                }
            })
            .on('drag', function(event) {
                if (!dragStartInfo.current) return;
                const newWidth = Math.max(200, dragStartInfo.current.width + (event.x - dragStartInfo.current.x));
                const newHeight = Math.max(200, dragStartInfo.current.height + (event.y - dragStartInfo.current.y));
                
                if (ghostFrameRef.current) {
                    ghostFrameRef.current.style.width = `${newWidth}px`;
                    ghostFrameRef.current.style.height = `${newHeight}px`;
                }
            })
            .on('end', function(event) {
                setIsDragging(false);
                if (ghostFrameRef.current) {
                    ghostFrameRef.current.style.display = 'none';
                }
                if (!dragStartInfo.current) return;
                
                const finalWidth = Math.max(200, dragStartInfo.current.width + (event.x - dragStartInfo.current.x));
                const finalHeight = Math.max(200, dragStartInfo.current.height + (event.y - dragStartInfo.current.y));
                setLayoutSize({ width: finalWidth, height: finalHeight });
                
                dragStartInfo.current = null;
            });
        
        handle.call(dragBehavior);
        
    }, [view, colorScale, layoutSize]);
    
    return (
        <div style={{ textAlign: 'center', fontFamily: 'sans-serif' }}>
            <style>{`.dragging * { user-select: none; -webkit-user-select: none; }`}</style>
            
            <div style={{ marginBottom: '10px' }}>
                <h1>국내 증시 시가총액 트리맵</h1>
                {view && view.depth > 0 && <button onClick={() => setView(view.parent)}>뒤로가기</button>}
                <h3>{view && view.ancestors().reverse().map(d => d.data.name).join(' > ')}</h3>
            </div>
            
            <div style={{ position: 'relative', display: 'inline-block'}}>
                {loading && <p>데이터를 불러오는 중입니다...</p>}
                {error && <p style={{ color: 'red' }}>{error}</p>}
                {/* SVG 자체에 userSelect: 'none' 스타일을 직접 추가합니다. */}
                <svg ref={svgRef} style={{ border: '1px solid #ccc', userSelect: 'none' }}></svg>
                
                <div
                    ref={ghostFrameRef}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        border: '2px dashed #007bff',
                        pointerEvents: 'none',
                        display: 'none',
                    }}
                ></div>
            </div>
        </div>
    );
}

export default App;

