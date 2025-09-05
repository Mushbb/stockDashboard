import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';

// ✨ [추가됨] useInterval 커스텀 Hook
function useInterval(callback, delay) {
    const savedCallback = useRef();
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);
    useEffect(() => {
        function tick() {
            savedCallback.current();
        }
        if (delay !== null) {
            let id = setInterval(tick, delay);
            return () => clearInterval(id);
        }
    }, [delay]);
}

// ✨ [추가됨] 계층 경로를 찾아주는 헬퍼 함수들
const getNodePath = (node) => node.ancestors().map(d => d.data.name).reverse();
const findNodeByPath = (root, path) => {
    let current = root;
    for (let i = 1; i < path.length; i++) {
        const name = path[i];
        const next = (current.children || []).find(d => d.data.name === name);
        if (!next) return null;
        current = next;
    }
    return current;
};

// 서버에서 받은 플랫 리스트 데이터를 D3 계층 구조로 변환
function transformData(flatData) {
    const groupedData = d3.group(flatData, d => d.sectorName);
    const children = Array.from(groupedData, ([key, value]) => {
        const sectorName = key || '기타 섹터';
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
    const [isUpdating, setIsUpdating] = useState(false);
    
    const svgRef = useRef(null);
    const ghostFrameRef = useRef(null);
    const dragStartInfo = useRef(null);
    
    const MIN_PIXEL = 15;
    
    // ✨ [추가됨] 데이터 업데이트 로직을 별도 함수로 분리
    const fetchAndUpdateData = useCallback(async () => {
        if (!view) return;
        
        setIsUpdating(true);
        try {
            const currentPath = getNodePath(view);
            
            const res = await fetch('/api/market-data');
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const flatJsonData = await res.json();
            
            const data = transformData(flatJsonData);
            
            let newRoot = d3.hierarchy(data).sum(d => d.value || 0).sort((a, b) => b.value - a.value);
            newRoot.eachAfter(node => {
                if (node.children) {
                    const total = node.value;
                    node.data.fluc_rate = total > 0 ? d3.sum(node.children, d => (d.data.fluc_rate || 0) * d.value) / total : 0;
                }
            });
            
            const newView = findNodeByPath(newRoot, currentPath);
            setView(newView || newRoot);
            
        } catch (e) {
            console.error("Failed to update data:", e);
        } finally {
            setIsUpdating(false);
        }
    }, [view]);
    
    // ✨ [추가됨] 30초마다 데이터 업데이트 실행
    useInterval(fetchAndUpdateData, 30000);
    
    // 초기 데이터 로딩 useEffect
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
    
    // 렌더링과 드래그 로직을 통합한 useEffect
    useEffect(() => {
        if (!view || !colorScale) return;
        
        const { width, height } = layoutSize;
        
        // --- 1. SVG 렌더링 ---
        const rootForLayout = view.copy();
        const treemap = d3.treemap().tile(d3.treemapSquarify).size([width, height]).padding(2).round(true);
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
        
        const handleSize = 20;
        const handle = svg.append('g').style('cursor', 'nwse-resize');
        handle.append('path').attr('d', `M${width - handleSize},${height} L${width},${height} L${width},${height - handleSize} Z`).attr('fill', '#666').attr('stroke', 'white');
        
        const dragBehavior = d3.drag()
            .on('start', function(event) {
                event.sourceEvent.preventDefault();
                event.sourceEvent.stopPropagation();
                setIsDragging(true);
                dragStartInfo.current = { width: layoutSize.width, height: layoutSize.height, x: event.x, y: event.y };
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
            <div style={{ marginBottom: '10px' }}>
                <h1>
                    국내 증시 시가총액 트리맵
                    {isUpdating && <span style={{ marginLeft: '10px', fontSize: '16px' }}>🔄</span>}
                </h1>
                {view && view.depth > 0 && <button onClick={() => setView(view.parent)}>뒤로가기</button>}
                <h3>{view && view.ancestors().reverse().map(d => d.data.name).join(' > ')}</h3>
            </div>
            
            <div style={{ position: 'relative', display: 'inline-block'}}>
                {loading && <p>데이터를 불러오는 중입니다...</p>}
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <svg ref={svgRef} style={{ border: '1px solid #ccc', userSelect: 'none' }}></svg>
                
                <div
                    ref={ghostFrameRef}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        border: '2px dashed #007bff',
                        pointerEvents: 'none',
                        boxSizing: 'border-box',
                        display: isDragging ? 'block' : 'none',
                    }}
                ></div>
            </div>
        </div>
    );
}

export default App;

