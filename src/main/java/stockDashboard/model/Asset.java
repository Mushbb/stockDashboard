package stockDashboard.model;

/**
 * 금융 자산을 나타내는 데이터 모델입니다.
 * @param assetId 자산 ID
 * @param assetName 자산명
 * @param assetType 자산 유형 (e.g., 'stock', 'etf')
 * @param assetCode 종목 코드
 */
public record Asset(
		String assetId,
		String assetName,
		String assetType,
		String assetCode
	) { }
