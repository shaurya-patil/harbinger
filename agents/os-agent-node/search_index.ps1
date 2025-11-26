$conn = New-Object -ComObject ADODB.Connection
$conn.Open("Provider=Search.CollatorDSO;Extended Properties='Application=Windows'")
$rs = $conn.Execute("SELECT System.ItemName, System.ItemUrl FROM SYSTEMINDEX WHERE System.Kind = 'program' AND System.ItemName LIKE '%WhatsApp%'")
if (-not $rs.EOF) {
    $rs.MoveFirst()
    while (-not $rs.EOF) {
        Write-Output ($rs.Fields.Item("System.ItemName").Value + " -> " + $rs.Fields.Item("System.ItemUrl").Value)
        $rs.MoveNext()
    }
}
