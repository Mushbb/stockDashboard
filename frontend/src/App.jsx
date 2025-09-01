import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

// 서버에서 받은 플랫 리스트 데이터를 D3 계층 구조로 변환
function transformData(flatData) {
    const groupedData = d3.group(flatData, d => d.sectorName);
    
    const children = Array.from(groupedData, ([key, value]) => {
        const sectorName = key || '기타 섹터';
        const sortedStocks = value.sort((a, b) => (b.mktcap || 0) - (a.mktcap || 0));
        
        const sectorChildren = [];
        let cutoffIndex = sortedStocks.length;
        
        if (sortedStocks.length > 1) {
            for (let i = 0; i < sortedStocks.length; i++) {
                const currentStockValue = sortedStocks[i].mktcap || 0;
                const restStocks = sortedStocks.slice(i + 1);
                const restSum = d3.sum(restStocks, d => d.mktcap || 0);
                
                if (restSum < currentStockValue && restStocks.length > 0) {
                    cutoffIndex = i + 1;
                    break;
                }
            }
        }
        
        const topStocks = sortedStocks.slice(0, cutoffIndex);
        topStocks.forEach(item => {
            sectorChildren.push({
                name: item.nodeName || '이름없음',
                value: item.mktcap || 0,
                fluc_rate: item.fluc_rate || 0,
            });
        });
        
        const etcStocks = sortedStocks.slice(cutoffIndex);
        if (etcStocks.length > 0) {
            const etcStocksValue = d3.sum(etcStocks, d => d.mktcap || 0);
            if (etcStocksValue > 0) {
                const weightedEtcRate =
                    d3.sum(etcStocks, d => (d.mktcap || 0) * (d.fluc_rate || 0)) / etcStocksValue;
                sectorChildren.push({
                    name: '기타',
                    value: etcStocksValue,
                    fluc_rate: weightedEtcRate,
                    count: etcStocks.length
                });
            }
        }
        
        return { name: sectorName, children: sectorChildren };
    });
    
    return { name: 'Market', children };
}

/**
 * 1차 레이아웃 결과(픽셀 크기)를 바탕으로
 * minPixel 미만 리프 노드를 **데이터 트리에서 제거**하고
 * 필터링된 새 데이터 트리를 반환
 */
function pruneByPixel(root, minPixel) {
    // 1) 유지해야 할 data 객체들을 수집 (리프가 기준, 조상은 자동 포함)
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
    
    // 2) data 트리를 keep Set 기준으로 재구성
    function cloneFilter(d) {
        if (!keep.has(d)) return null;
        if (!d.children) return { ...d };
        const kids = d.children.map(cloneFilter).filter(Boolean);
        return { ...d, children: kids };
    }
    
    const pruned = cloneFilter(root.data);
    // 모든 리프가 잘렸을 때 대비: 최소한 루트만 남기기
    return pruned || { name: root.data?.name || 'Market', children: [] };
}

function App() {
    const [view, setView] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [colorScale, setColorScale] = useState(null);
    const svgRef = useRef(null);
    
    // 레이아웃 크기와 최소 픽셀 기준 (필요시 조절)
    const LAYOUT_W = 1000;
    const LAYOUT_H = 500;
    const MIN_PIXEL = 15;
    
    useEffect(() => {
        const apiUrl = '/api/market-data';
        fetch(apiUrl)
            .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP error! status: ${res.status}`))))
            .then(flatJsonData => {
                if (!flatJsonData || flatJsonData.length === 0) throw new Error('서버 데이터가 비어있습니다.');
                const blob = new Blob([JSON.stringify(flatJsonData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = 'market-data.json';
                a.click();
                
                URL.revokeObjectURL(url); // 메모리 해제
                
                const data = transformData(flatJsonData);
                
                // 1) 원본 계층 구성 & 합계
                let root = d3.hierarchy(data)
                    .sum(d => d.value || 0)
                    .sort((a, b) => b.value - a.value);
                
                // 색상 스케일: 0% 흰색, 하락 빨강, 상승 초록
                const color = d3.scaleDiverging()
                    .domain([-5, 0, 5])
                    .interpolator(t => (t < 0.5
                        ? d3.interpolateRgb('red', 'white')(t / 0.5)
                        : d3.interpolateRgb('white', 'green')((t - 0.5) / 0.5)))
                    .clamp(true);
                setColorScale(() => color);
                
                const treemap = d3.treemap()
                    .tile(d3.treemapBinary)
                    .size([LAYOUT_W, LAYOUT_H])
                    .padding(2)
                    .round(true);
                
                // 2) 1차 레이아웃
                treemap(root);
                
                // 3) 픽셀 기준으로 작은 리프 제거 → 데이터 트리 재구성
                const prunedData = pruneByPixel(root, MIN_PIXEL);
                
                // 4) 필터된 데이터로 재계층 & 가중 등락률 재계산
                root = d3.hierarchy(prunedData)
                    .sum(d => d.value || 0)
                    .sort((a, b) => b.value - a.value);
                
                root.eachAfter(node => {
                    if (node.children) {
                        const total = node.value;
                        node.data.fluc_rate = total > 0
                            ? d3.sum(node.children, d => (d.data.fluc_rate || 0) * d.value) / total
                            : 0;
                    }
                });
                
                // 5) 2차 레이아웃 (구멍 없이 재배치)
                treemap(root);
                
                setView(root);
                setLoading(false);
            })
            .catch(e => {
                console.error('API 호출 오류:', e);
                setError(`데이터 로딩 실패: ${e.message}`);
                setLoading(false);
            });
    }, []);
    
    useEffect(() => {
        if (!view || !colorScale) return;
        
        const width = LAYOUT_W;
        const height = LAYOUT_H;
        const x = d3.scaleLinear().rangeRound([0, width]).domain([view.x0, view.x1]);
        const y = d3.scaleLinear().rangeRound([0, height]).domain([view.y0, view.y1]);
        
        const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
        svg.selectAll('*').remove();
        const group = svg.append('g');
        
        const cell = group.selectAll('g')
            .data(view.children || [])
            .join('g')
            .attr('transform', d => `translate(${x(d.x0)}, ${y(d.y0)})`)
            .style('cursor', d => (d.children ? 'pointer' : 'default'))
            .on('click', (event, d) => { if (d.children) setView(d); });
        
        cell.append('rect')
            .attr('fill', d => colorScale(d.data.fluc_rate))
            .attr('width', d => x(d.x1) - x(d.x0))
            .attr('height', d => y(d.y1) - y(d.y0));
        
        // 텍스트는 박스가 충분히 클 때만
        cell.each(function (d) {
            const node = d3.select(this);
            const w = x(d.x1) - x(d.x0);
            const h = y(d.y1) - y(d.y0);
            if (w >= 40 && h >= 40) {
                const fo = node.append('foreignObject').attr('width', w).attr('height', h);
                const div = fo.append('xhtml:div')
                    .style('display', 'flex')
                    .style('flex-direction', 'column')
                    .style('align-items', 'center')
                    .style('justify-content', 'center')
                    .style('width', '100%')
                    .style('height', '100%')
                    .style('overflow', 'hidden')
                    .style('text-align', 'center')
                    .style('color', 'white')
                    .style('font-weight', 'bold')
                    .style('font-size', `${Math.min(w / 4, h / 3, 22)}px`);
                
                div.append('xhtml:p')
                    .style('margin', '0')
                    .style('padding', '0 2px')
                    .text(d.data.name);
                
                const rate = d.data.fluc_rate || 0;
                const rateText = div.append('xhtml:p')
                    .style('margin', '2px 0 0 0')
                    .style('padding', '0')
                    .text(`${rate > 0 ? '+' : ''}${rate.toFixed(2)}%`);
                
                if (rate > 0) rateText.style('color', '#a1ff9b');
                else if (rate < 0) rateText.style('color', '#ff9b9b');
            }
        });
        
        cell.append('title')
            .text(d => {
                const rateText = (d.data.fluc_rate || 0).toFixed(2);
                const baseText =
                    `${d.parent?.data?.name || ''}\n${d.data.name}\n등락률: ${rateText}%\n시가총액: ${d.value?.toLocaleString()} 원`;
                return (d.data.name === '기타' && d.data.count)
                    ? `${baseText}\n(${d.data.count}개 종목 합산)` : baseText;
            });
        
    }, [view, colorScale]);
    
    return (
        <div style={{ textAlign: 'center', fontFamily: 'sans-serif' }}>
            <div style={{ marginBottom: '10px' }}>
                <h1>국내 증시 시가총액 트리맵</h1>
                {view && view.depth > 0 && <button onClick={() => setView(view.parent)}>뒤로가기</button>}
                <h3>{view && view.ancestors().reverse().map(d => d.data.name).join(' > ')}</h3>
            </div>
            {loading && <p>서버에서 데이터를 불러오는 중입니다...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <svg ref={svgRef}></svg>
        </div>
    );
}

export default App;
