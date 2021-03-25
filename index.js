//使用 WebSocket 的網址向 Server 開啟連結
let ws = new WebSocket('ws://localhost:3000')

//開啟後執行的動作，指定一個 function 會在連結 WebSocket 後執行
ws.onopen = () => {
    console.log('open connection')
    ws.onmessage = event => {
        //console.log(event.data);
        if (event.data == 'findBLEService')
            document.getElementById('btn').disabled = false;
        else if (event.data == 'step1')
            document.getElementById('step1').style.visibility = 'visible';
        else if (event.data == 'step2')
            document.getElementById('step2').style.visibility = 'visible';
        else if (event.data == 'step3')
            document.getElementById('step3').style.visibility = 'visible';
        else if (event.data == 'step4')
            document.getElementById('step4').style.visibility = 'visible';
        else if (event.data == 'step5')
            document.getElementById('step5').style.visibility = 'visible';
        else if (event.data == 'step6-1'){
            document.getElementById('step6').style.visibility = 'visible';
            document.getElementById('btn').disabled = false;
            document.getElementById('btn').value = "停車完畢";
            document.getElementById("btn").onclick = disconnectBLE;
        }
        else if (event.data == 'step6-2'){
            var console = document.getElementById('console');
            console.innerHTML = '交易失敗';
        }
        else{
			var jsonobj = JSON.parse(event.data);
			var intime = jsonobj.getInTime;
			var outtime = jsonobj.getOutTime;
			var fee = jsonobj.fee;
			var output = '停車時間: '+intime+' 離開時間: '+outtime+' 停車費用: '+fee+'wei';
            var console = document.getElementById('console');
            console.innerHTML = output;	
            document.getElementById('btn').value = "成功離場";
		}
    }
}

//關閉後執行的動作，指定一個 function 會在連結中斷後執行
ws.onclose = () => {
    console.log('close connection')
}

function connectBLE() {
    console.log('startParking');
    document.getElementById('btn').disabled = true;
    ws.send('startParking');
}

function disconnectBLE(){
    console.log('endParking');
    document.getElementById('btn').disabled = true;
    ws.send('endParking');
}
